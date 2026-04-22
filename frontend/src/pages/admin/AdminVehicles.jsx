import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
  name: "", brand: "", category: "Kompakt", transmission: "Automatik", fuel: "Benzin",
  seats: 5, doors: 4, price_per_day: 49, image_url: "", description: "", features: [], active: true, location_id: "",
};

const CATEGORIES = ["Kleinwagen", "Kompakt", "Mittelklasse", "SUV", "Van", "Luxus", "Transporter"];
const TRANSMISSIONS = ["Automatik", "Schaltgetriebe"];
const FUELS = ["Benzin", "Diesel", "Elektro", "Hybrid"];

export default function AdminVehicles() {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [featuresText, setFeaturesText] = useState("");

  const load = async () => {
    const [v, l] = await Promise.all([api.get("/admin/vehicles"), api.get("/admin/locations")]);
    setItems(v.data); setLocations(l.data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    const defaultLoc = locations[0]?.id || "";
    setForm({ ...EMPTY, location_id: defaultLoc });
    setFeaturesText("");
    setOpen(true);
  };
  const openEdit = (v) => {
    setEditing(v);
    setForm({ ...v });
    setFeaturesText((v.features || []).join(", "));
    setOpen(true);
  };

  const save = async () => {
    const payload = { ...form, features: featuresText.split(",").map((s) => s.trim()).filter(Boolean),
      seats: Number(form.seats), doors: Number(form.doors), price_per_day: Number(form.price_per_day) };
    try {
      if (editing) await api.put(`/vehicles/${editing.id}`, payload);
      else await api.post("/vehicles", payload);
      toast.success(editing ? "Fahrzeug aktualisiert" : "Fahrzeug erstellt");
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Fahrzeug deaktivieren?")) return;
    try { await api.delete(`/vehicles/${id}`); toast.success("Deaktiviert"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="admin-vehicles" className="rf-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-[#0055FF] font-semibold">Flotte</div>
          <h1 className="font-display text-3xl font-bold text-[#0A192F] mt-1">Fahrzeuge</h1>
        </div>
        <Button className="bg-[#0055FF] hover:bg-[#0044CC]" onClick={openNew} data-testid="vehicle-new-btn">
          <Plus size={16} className="mr-2" /> Neues Fahrzeug
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left p-3">Fahrzeug</th>
              <th className="text-left p-3">Kategorie</th>
              <th className="text-left p-3">Preis/Tag</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((v) => (
              <tr key={v.id} data-testid={`admin-vehicle-${v.id}`}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img src={v.image_url} alt="" className="w-14 h-10 object-cover rounded border border-slate-100" />
                    <div>
                      <div className="font-semibold text-[#0A192F]">{v.brand} {v.name}</div>
                      <div className="text-xs text-slate-500">{v.transmission} · {v.fuel}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-slate-600">{v.category}</td>
                <td className="p-3 font-semibold text-[#0A192F]">{v.price_per_day}€</td>
                <td className="p-3">
                  <Badge className={v.active ? "bg-emerald-100 text-emerald-800 border-0" : "bg-red-100 text-red-800 border-0"}>
                    {v.active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(v)} data-testid={`vehicle-edit-${v.id}`}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(v.id)} data-testid={`vehicle-delete-${v.id}`}><Trash2 size={14} /></Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-slate-500">Keine Fahrzeuge vorhanden.</td></tr>)}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Field label="Bild-URL"><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." data-testid="vf-image" /></Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Beschreibung"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} data-testid="vf-desc" /></Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Features (Komma-getrennt)"><Input value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} data-testid="vf-features" /></Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button className="bg-[#0055FF] hover:bg-[#0044CC]" onClick={save} data-testid="vf-save">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><Label className="mb-1.5 block text-xs text-slate-500">{label}</Label>{children}</div>);
}
