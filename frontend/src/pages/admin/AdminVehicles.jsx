import { useEffect, useRef, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, Upload, Star, X, ArrowLeft, ArrowRight, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { FEATURE_CATALOG, ALL_FEATURES } from "@/lib/featureCatalog";

const EMPTY = {
  name: "", brand: "", category: "Kompakt", transmission: "Automatik", fuel: "Benzin",
  seats: 5, doors: 4, price_per_day: 49, image_url: "", images: [], description: "", features: [], active: true, location_id: "",
};

const CATEGORIES = ["Kleinwagen", "Kompakt", "Mittelklasse", "SUV", "Van", "Luxus", "Transporter"];
const TRANSMISSIONS = ["Automatik", "Schaltgetriebe"];
const FUELS = ["Benzin", "Diesel", "Elektro", "Hybrid"];

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

function resolveImg(url) {
  if (!url) return "";
  if (url.startsWith("/api/")) return BACKEND + url;
  return url;
}

export default function AdminVehicles() {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [customFeature, setCustomFeature] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    const [v, l] = await Promise.all([api.get("/admin/vehicles"), api.get("/admin/locations")]);
    setItems(v.data); setLocations(l.data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    const defaultLoc = locations[0]?.id || "";
    setForm({ ...EMPTY, location_id: defaultLoc });
    setCustomFeature("");
    setExternalUrl("");
    setOpen(true);
  };
  const openEdit = (v) => {
    setEditing(v);
    setForm({
      ...EMPTY,
      ...v,
      images: v.images && v.images.length > 0
        ? v.images
        : (v.image_url ? [v.image_url] : []),
    });
    setCustomFeature("");
    setExternalUrl("");
    setOpen(true);
  };

  const save = async () => {
    if (!form.brand || !form.name) {
      toast.error("Bitte Marke und Modell angeben");
      return;
    }
    const images = form.images.filter(Boolean);
    const payload = {
      ...form,
      images,
      image_url: images[0] || form.image_url || "",
      features: (form.features || []).filter(Boolean),
      seats: Number(form.seats),
      doors: Number(form.doors),
      price_per_day: Number(form.price_per_day),
    };
    try {
      if (editing) await api.put(`/vehicles/${editing.id}`, payload);
      else await api.post("/vehicles", payload);
      toast.success(editing ? "Fahrzeug aktualisiert" : "Fahrzeug erstellt");
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const del = async (v) => {
    const action = v.active
      ? "deaktivieren (kann später wieder aktiviert werden)"
      : "endgültig löschen";
    if (!window.confirm(`Fahrzeug "${v.brand} ${v.name}" ${action}?`)) return;
    try {
      if (v.active) {
        await api.delete(`/vehicles/${v.id}`);
        toast.success("Fahrzeug deaktiviert");
      } else {
        await api.delete(`/vehicles/${v.id}?hard=true`);
        toast.success("Fahrzeug gelöscht");
      }
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  // ---- Image handling ----
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setUploading(true);
    try {
      if (editing) {
        // Upload to backend immediately
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          const res = await api.post(`/admin/vehicles/${editing.id}/images`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setForm((f) => ({ ...f, images: res.data.images }));
        }
        toast.success(`${files.length} Bild${files.length > 1 ? "er" : ""} hochgeladen`);
      } else {
        // New vehicle: store as data URLs until saved, then explain
        toast.message("Bitte erst Fahrzeug speichern, dann Bilder hochladen", {
          description: "Hochladen funktioniert für gespeicherte Fahrzeuge.",
        });
      }
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addUrl = () => {
    const u = externalUrl.trim();
    if (!u) return;
    if (form.images.includes(u)) {
      toast.message("URL bereits in Liste");
      return;
    }
    setForm((f) => ({ ...f, images: [...f.images, u] }));
    setExternalUrl("");
  };

  const removeImage = async (url) => {
    if (editing && url.startsWith("/api/")) {
      try {
        await api.delete(`/admin/vehicles/${editing.id}/images`, { params: { url } });
      } catch (e) {
        toast.error(apiError(e));
        return;
      }
    }
    setForm((f) => ({ ...f, images: f.images.filter((u) => u !== url) }));
  };

  const moveImage = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= form.images.length) return;
    const arr = [...form.images];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setForm((f) => ({ ...f, images: arr }));
  };

  const setPrimary = (url) => {
    setForm((f) => ({ ...f, images: [url, ...f.images.filter((u) => u !== url)] }));
  };

  // ---- Features ----
  const toggleFeature = (name) => {
    setForm((f) => ({
      ...f,
      features: f.features.includes(name)
        ? f.features.filter((x) => x !== name)
        : [...f.features, name],
    }));
  };

  const addCustomFeature = () => {
    const v = customFeature.trim();
    if (!v) return;
    if (form.features.includes(v)) { setCustomFeature(""); return; }
    setForm((f) => ({ ...f, features: [...f.features, v] }));
    setCustomFeature("");
  };

  const customFeatures = (form.features || []).filter((f) => !ALL_FEATURES.includes(f));

  return (
    <div data-testid="admin-vehicles" className="rf-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-[#E11226] font-semibold">Flotte</div>
          <h1 className="font-display text-3xl font-bold text-[#0A0A0A] mt-1">Fahrzeuge</h1>
        </div>
        <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={openNew} data-testid="vehicle-new-btn">
          <Plus size={16} className="mr-2" /> Neues Fahrzeug
        </Button>
      </div>

      <div className="bg-white border border-[#E5E5E5] rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F4F4] text-xs uppercase tracking-wider text-[#525252]">
            <tr>
              <th className="text-left p-3">Fahrzeug</th>
              <th className="text-left p-3">Kategorie</th>
              <th className="text-left p-3">Bilder</th>
              <th className="text-left p-3">Ausstattung</th>
              <th className="text-left p-3">Preis/Tag</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E5]">
            {items.map((v) => {
              const cover = resolveImg(v.images?.[0] || v.image_url);
              const imgCount = v.images?.length || (v.image_url ? 1 : 0);
              return (
                <tr key={v.id} data-testid={`admin-vehicle-${v.id}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <img src={cover} alt="" className="w-14 h-10 object-cover rounded-sm border border-[#E5E5E5]" />
                      <div>
                        <div className="font-semibold text-[#0A0A0A]">{v.brand} {v.name}</div>
                        <div className="text-xs text-[#525252]">{v.transmission} · {v.fuel}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-[#525252]">{v.category}</td>
                  <td className="p-3 text-[#525252] rf-readout">{imgCount}</td>
                  <td className="p-3 text-[#525252] rf-readout">{v.features?.length || 0}</td>
                  <td className="p-3 font-semibold text-[#0A0A0A]">{v.price_per_day}€</td>
                  <td className="p-3">
                    <Badge className={v.active ? "bg-emerald-100 text-emerald-800 border-0" : "bg-red-100 text-red-800 border-0"}>
                      {v.active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(v)} data-testid={`vehicle-edit-${v.id}`}><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(v)} data-testid={`vehicle-delete-${v.id}`} title={v.active ? "Deaktivieren" : "Endgültig löschen"}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (<tr><td colSpan={7} className="p-8 text-center text-[#525252]">Keine Fahrzeuge vorhanden.</td></tr>)}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Marke"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} data-testid="vf-brand" /></Field>
            <Field label="Modell"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="vf-name" /></Field>
            <Field label="Kategorie">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="vf-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Getriebe">
              <Select value={form.transmission} onValueChange={(v) => setForm({ ...form, transmission: v })}>
                <SelectTrigger data-testid="vf-transmission"><SelectValue /></SelectTrigger>
                <SelectContent>{TRANSMISSIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Kraftstoff">
              <Select value={form.fuel} onValueChange={(v) => setForm({ ...form, fuel: v })}>
                <SelectTrigger data-testid="vf-fuel"><SelectValue /></SelectTrigger>
                <SelectContent>{FUELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Sitze"><Input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} data-testid="vf-seats" /></Field>
            <Field label="Türen"><Input type="number" value={form.doors} onChange={(e) => setForm({ ...form, doors: e.target.value })} data-testid="vf-doors" /></Field>
            <Field label="Preis/Tag (€)"><Input type="number" value={form.price_per_day} onChange={(e) => setForm({ ...form, price_per_day: e.target.value })} data-testid="vf-price" /></Field>
            <Field label="Standort">
              <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                <SelectTrigger data-testid="vf-location"><SelectValue placeholder="Standort wählen" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Beschreibung"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} data-testid="vf-desc" /></Field>
            </div>
          </div>

          {/* Images section */}
          <div className="mt-6 pt-5 border-t border-[#E5E5E5]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#525252]">Bilder</div>
                <div className="text-sm text-[#0A0A0A] font-semibold">
                  {form.images.length} Bild{form.images.length !== 1 ? "er" : ""} · Erstes Bild = Cover
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                  data-testid="vf-image-file-input"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !editing}
                  title={editing ? "Bilder hochladen" : "Erst Fahrzeug speichern, dann Bilder hochladen"}
                  data-testid="vf-image-upload-btn"
                >
                  <Upload size={14} className="mr-1.5" /> {uploading ? "Lädt…" : "Datei hochladen"}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
                placeholder="https://… (externe Bild-URL)"
                data-testid="vf-image-url"
              />
              <Button type="button" variant="outline" onClick={addUrl} data-testid="vf-image-url-add">
                <LinkIcon size={14} className="mr-1.5" /> Hinzufügen
              </Button>
            </div>

            {form.images.length === 0 ? (
              <div
                className="border border-dashed border-[#D4D4D4] rounded-sm p-8 text-center text-sm text-[#525252]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              >
                {editing
                  ? "Bilder hier ablegen oder über die Buttons oben hinzufügen."
                  : "Speichere zuerst das Fahrzeug, dann lade Bilder hoch."}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="vf-image-grid">
                {form.images.map((url, idx) => (
                  <div key={url} className="relative group border border-[#E5E5E5] rounded-sm overflow-hidden bg-[#F4F4F4]">
                    <img src={resolveImg(url)} alt="" className="w-full aspect-video object-cover" />
                    {idx === 0 && (
                      <div className="absolute top-1 left-1 bg-[#E11226] text-white text-[10px] px-1.5 py-0.5 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Star size={10} fill="currentColor" /> Cover
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition flex items-end justify-between p-1.5 opacity-0 group-hover:opacity-100">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveImage(idx, -1)}
                          disabled={idx === 0}
                          className="w-7 h-7 bg-white/95 text-[#0A0A0A] flex items-center justify-center hover:bg-white disabled:opacity-40 rounded-sm"
                          title="Nach links"
                        >
                          <ArrowLeft size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(idx, 1)}
                          disabled={idx === form.images.length - 1}
                          className="w-7 h-7 bg-white/95 text-[#0A0A0A] flex items-center justify-center hover:bg-white disabled:opacity-40 rounded-sm"
                          title="Nach rechts"
                        >
                          <ArrowRight size={12} />
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => setPrimary(url)}
                            className="w-7 h-7 bg-[#E11226] text-white flex items-center justify-center hover:bg-[#C20E1F] rounded-sm"
                            title="Als Cover setzen"
                            data-testid={`vf-image-primary-${idx}`}
                          >
                            <Star size={12} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          className="w-7 h-7 bg-white text-red-600 flex items-center justify-center hover:bg-red-50 rounded-sm"
                          title="Entfernen"
                          data-testid={`vf-image-remove-${idx}`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Features section */}
          <div className="mt-6 pt-5 border-t border-[#E5E5E5]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#525252]">Ausstattung</div>
                <div className="text-sm text-[#0A0A0A] font-semibold">
                  {form.features.length} ausgewählt
                </div>
              </div>
              {form.features.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setForm({ ...form, features: [] })}
                  data-testid="vf-features-clear"
                  className="text-xs"
                >
                  Alle entfernen
                </Button>
              )}
            </div>

            <div className="space-y-4" data-testid="vf-features-catalog">
              {FEATURE_CATALOG.map((group) => (
                <div key={group.group}>
                  <div className="text-[10px] uppercase tracking-wider text-[#A3A3A3] mb-1.5">
                    {group.group}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => {
                      const on = form.features.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleFeature(item)}
                          className={`text-xs px-2.5 py-1 rounded-sm border transition ${
                            on
                              ? "bg-[#E11226] text-white border-[#E11226]"
                              : "bg-white text-[#262626] border-[#E5E5E5] hover:border-[#A3A3A3]"
                          }`}
                          data-testid={`vf-feature-${item.replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[#F4F4F4]">
              <div className="text-[10px] uppercase tracking-wider text-[#A3A3A3] mb-1.5">
                Eigene Ausstattung
              </div>
              <div className="flex gap-2">
                <Input
                  value={customFeature}
                  onChange={(e) => setCustomFeature(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomFeature(); } }}
                  placeholder="z.B. Sitzbelüftung hinten"
                  data-testid="vf-feature-custom"
                />
                <Button type="button" variant="outline" onClick={addCustomFeature} data-testid="vf-feature-custom-add">
                  <Plus size={14} className="mr-1.5" /> Hinzufügen
                </Button>
              </div>
              {customFeatures.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {customFeatures.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-sm bg-[#0A0A0A] text-white"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => toggleFeature(c)}
                        className="hover:text-red-300"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={save} data-testid="vf-save">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><Label className="mb-1.5 block text-xs text-[#525252]">{label}</Label>{children}</div>);
}
