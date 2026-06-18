import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", address: "", city: "", postal_code: "", phone: "", email: "", active: true };

export default function AdminLocations() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get("/admin/locations").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api.put(`/locations/${editing.id}`, form);
      else await api.post("/locations", form);
      toast.success(editing ? "Standort aktualisiert" : "Standort erstellt");
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const del = async (loc) => {
    const action = loc.active
      ? "deaktivieren (kann später wieder aktiviert werden)"
      : "endgültig löschen";
    if (!window.confirm(`Standort "${loc.name}" ${action}?`)) return;
    try {
      if (loc.active) {
        await api.delete(`/locations/${loc.id}`);
        toast.success("Standort deaktiviert");
      } else {
        await api.delete(`/locations/${loc.id}?hard=true`);
        toast.success("Standort gelöscht");
      }
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div data-testid="admin-locations" className="rf-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-[#E11226] font-semibold">Filialen</div>
          <h1 className="font-display text-3xl font-bold text-[#0A0A0A] mt-1">Standorte</h1>
        </div>
        <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} data-testid="location-new-btn">
          <Plus size={16} className="mr-2" /> Neuer Standort
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((l) => (
          <div key={l.id} className="bg-white border border-[#E5E5E5] rounded-lg p-5" data-testid={`admin-location-${l.id}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#FEE2E5] text-[#E11226] flex items-center justify-center">
                  <MapPin size={16} />
                </div>
                <div>
                  <div className="font-semibold text-[#0A0A0A]">{l.name}</div>
                  <div className="text-xs text-[#525252] mt-0.5">{l.address}</div>
                  <div className="text-xs text-[#525252]">{l.postal_code} {l.city}</div>
                </div>
              </div>
              <Badge className={l.active ? "bg-emerald-100 text-emerald-800 border-0" : "bg-[#F4F4F4] text-[#525252] border-0"}>
                {l.active ? "Aktiv" : "Inaktiv"}
              </Badge>
            </div>
            <div className="mt-4 pt-4 border-t border-[#E5E5E5] flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(l); setForm(l); setOpen(true); }} data-testid={`location-edit-${l.id}`}>
                <Pencil size={14} className="mr-1" /> Bearbeiten
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => del(l)} data-testid={`location-delete-${l.id}`} title={l.active ? "Deaktivieren" : "Endgültig löschen"}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="col-span-2 text-center py-10 text-[#525252]">Keine Standorte vorhanden.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Standort bearbeiten" : "Neuer Standort"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="mb-1.5 block text-xs text-[#525252]">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="lf-name" /></div>
            <div><Label className="mb-1.5 block text-xs text-[#525252]">Adresse</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="lf-address" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1"><Label className="mb-1.5 block text-xs text-[#525252]">PLZ</Label>
                <Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} data-testid="lf-plz" /></div>
              <div className="col-span-2"><Label className="mb-1.5 block text-xs text-[#525252]">Stadt</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="lf-city" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1.5 block text-xs text-[#525252]">Telefon</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+49 ..." data-testid="lf-phone" /></div>
              <div><Label className="mb-1.5 block text-xs text-[#525252]">E-Mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="kontakt@rentfux.de" data-testid="lf-email" /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="lf-active" />
              <span className="text-sm text-[#525252]">Aktiv</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={save} data-testid="lf-save">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
