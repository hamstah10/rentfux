import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { code: "", type: "percent", value: 10, max_uses: null, min_total: 0, valid_until: "", active: true };

export default function AdminDiscounts() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get("/admin/discounts").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      min_total: form.min_total ? Number(form.min_total) : 0,
      valid_until: form.valid_until || null,
      active: form.active,
    };
    try {
      if (editing) await api.put(`/admin/discounts/${editing.code}`, payload);
      else await api.post("/admin/discounts", payload);
      toast.success(editing ? "Rabattcode aktualisiert" : "Rabattcode erstellt");
      setOpen(false);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const del = async (code) => {
    if (!window.confirm(`Rabattcode ${code} löschen?`)) return;
    try { await api.delete(`/admin/discounts/${code}`); toast.success("Gelöscht"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="admin-discounts" className="rf-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-[#E11226] font-semibold">Marketing</div>
          <h1 className="font-display text-3xl font-bold text-[#0A0A0A] mt-1">Rabattcodes</h1>
        </div>
        <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} data-testid="discount-new-btn">
          <Plus size={16} className="mr-2" /> Neuer Code
        </Button>
      </div>

      <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F4F4] text-xs uppercase tracking-wider text-[#525252]">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Typ</th>
              <th className="text-right p-3">Wert</th>
              <th className="text-right p-3">Genutzt / Max</th>
              <th className="text-left p-3">Mindestbestellwert</th>
              <th className="text-left p-3">Gültig bis</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E5]">
            {items.map((d) => (
              <tr key={d.code} data-testid={`admin-discount-${d.code}`}>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="text-[#E11226]" />
                    <span className="font-mono font-semibold text-[#0A0A0A]">{d.code}</span>
                  </div>
                </td>
                <td className="p-3 text-[#525252]">{d.type === "percent" ? "Prozent" : "Festbetrag"}</td>
                <td className="p-3 text-right font-semibold">{d.type === "percent" ? `${d.value}%` : `${d.value}€`}</td>
                <td className="p-3 text-right text-[#525252]">{d.used_count || 0}{d.max_uses ? ` / ${d.max_uses}` : ""}</td>
                <td className="p-3 text-[#525252]">{d.min_total ? `${d.min_total}€` : "—"}</td>
                <td className="p-3 text-[#525252] text-xs">{d.valid_until || "—"}</td>
                <td className="p-3">
                  <Badge className={d.active ? "bg-emerald-100 text-emerald-800 border-0" : "bg-[#F4F4F4] text-[#525252] border-0"}>
                    {d.active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(d); setForm({ ...d, valid_until: d.valid_until || "", min_total: d.min_total || 0 }); setOpen(true); }} data-testid={`discount-edit-${d.code}`}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del(d.code)} data-testid={`discount-delete-${d.code}`}>
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-[#525252]">Noch keine Rabattcodes erstellt.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Rabattcode bearbeiten" : "Neuer Rabattcode"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SOMMER20" className="uppercase font-mono" data-testid="df-code" disabled={!!editing} /></Field></div>
            <Field label="Typ">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger data-testid="df-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Prozent (%)</SelectItem>
                  <SelectItem value="fixed">Festbetrag (€)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={form.type === "percent" ? "Wert (%)" : "Wert (€)"}>
              <Input type="number" min="1" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} data-testid="df-value" />
            </Field>
            <Field label="Mindestbestellwert (€)"><Input type="number" min="0" step="0.01" value={form.min_total} onChange={(e) => setForm({ ...form, min_total: e.target.value })} data-testid="df-min" /></Field>
            <Field label="Max. Verwendungen"><Input type="number" min="0" value={form.max_uses || ""} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Unbegrenzt" data-testid="df-max" /></Field>
            <div className="md:col-span-2"><Field label="Gültig bis (optional)"><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} data-testid="df-until" /></Field></div>
            <div className="md:col-span-2 flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="df-active" />
              <span className="text-sm text-[#525252]">Aktiv</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={save} data-testid="df-save">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><Label className="mb-1.5 block text-xs text-[#525252]">{label}</Label>{children}</div>);
}
