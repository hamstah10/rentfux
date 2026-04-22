import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search } from "lucide-react";

const STATUSES = ["pending", "confirmed", "active", "completed", "cancelled"];
const STATUS_LABEL = {
  pending: "Ausstehend", confirmed: "Bestätigt", active: "Aktiv", completed: "Abgeschlossen", cancelled: "Storniert",
};
const STATUS_CLS = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  active: "bg-blue-100 text-blue-800",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminBookings() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const load = () => api.get("/admin/bookings").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try { await api.patch(`/admin/bookings/${id}`, { status }); toast.success("Status aktualisiert"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const filtered = items.filter((b) => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      b.user_email.toLowerCase().includes(needle) ||
      b.user_name.toLowerCase().includes(needle) ||
      b.vehicle_name.toLowerCase().includes(needle) ||
      b.id.includes(needle)
    );
  });

  return (
    <div data-testid="admin-bookings" className="rf-fade-in">
      <div className="mb-6">
        <div className="text-xs tracking-[0.2em] uppercase text-[#0055FF] font-semibold">Buchungen</div>
        <h1 className="font-display text-3xl font-bold text-[#0A192F] mt-1">Alle Buchungen ({items.length})</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche nach Kunde, Fahrzeug, ID..." className="pl-9" data-testid="booking-search" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="md:w-56" data-testid="booking-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">Kunde</th>
              <th className="text-left p-3">Fahrzeug</th>
              <th className="text-left p-3">Zeitraum</th>
              <th className="text-left p-3">Zahlung</th>
              <th className="text-right p-3">Gesamt</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((b) => (
              <tr key={b.id} data-testid={`admin-booking-${b.id}`}>
                <td className="p-3 font-mono text-xs text-slate-500">{b.id.slice(0, 8).toUpperCase()}</td>
                <td className="p-3">
                  <div className="font-semibold text-[#0A192F]">{b.user_name}</div>
                  <div className="text-xs text-slate-500">{b.user_email}</div>
                </td>
                <td className="p-3">
                  <div className="text-[#0A192F]">{b.vehicle_brand} {b.vehicle_name}</div>
                </td>
                <td className="p-3 text-slate-600 text-xs">{b.start_date}<br />→ {b.end_date}</td>
                <td className="p-3">
                  <Badge className={b.payment_status === "paid" ? "bg-emerald-100 text-emerald-800 border-0" : "bg-amber-100 text-amber-800 border-0"}>
                    {b.payment_status === "paid" ? "Bezahlt" : "Offen"}
                  </Badge>
                  <div className="text-[10px] uppercase text-slate-400 mt-1">{b.payment_method || "—"}</div>
                </td>
                <td className="p-3 text-right font-semibold">{b.total.toFixed(2)}€</td>
                <td className="p-3">
                  <Select value={b.status} onValueChange={(v) => updateStatus(b.id, v)}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <Badge className={`${STATUS_CLS[s]} border-0`}>{STATUS_LABEL[s]}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Keine Buchungen gefunden.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
