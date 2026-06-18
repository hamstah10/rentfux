import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User as UserIcon, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminCustomers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");

  const load = () => api.get("/admin/customers").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const del = async (u) => {
    if (!window.confirm(
      `Kunde "${u.name || u.email}" endgültig löschen?\n\nBuchungshistorie bleibt zu Abrechnungszwecken erhalten (anonymisiert).`
    )) return;
    try {
      await api.delete(`/admin/customers/${u.id}`);
      toast.success("Kunde gelöscht");
      load();
    } catch (e) {
      const msg = apiError(e);
      // Offer force-delete if active bookings exist
      if (msg.includes("aktive Buchung")) {
        if (window.confirm(`${msg}\n\nTrotzdem mit Stornierung erzwingen?`)) {
          try {
            await api.delete(`/admin/customers/${u.id}?force=true`);
            toast.success("Kunde gelöscht (mit aktiven Buchungen)");
            load();
            return;
          } catch (e2) {
            toast.error(apiError(e2));
            return;
          }
        }
        return;
      }
      toast.error(msg);
    }
  };

  const filtered = items.filter((u) => {
    if (!q) return true;
    const n = q.toLowerCase();
    return u.email.toLowerCase().includes(n) || (u.name || "").toLowerCase().includes(n);
  });

  return (
    <div data-testid="admin-customers" className="rf-fade-in">
      <div className="mb-6">
        <div className="text-xs tracking-[0.2em] uppercase text-[#E11226] font-semibold">Kundenverwaltung</div>
        <h1 className="font-display text-3xl font-bold text-[#0A0A0A] mt-1">Kunden ({items.length})</h1>
      </div>

      <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche nach Name oder E-Mail..." className="pl-9" data-testid="customer-search" />
        </div>
      </div>

      <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F4F4] text-xs uppercase tracking-wider text-[#525252]">
            <tr>
              <th className="text-left p-3">Kunde</th>
              <th className="text-left p-3">E-Mail</th>
              <th className="text-left p-3">Telefon</th>
              <th className="text-left p-3">Registriert</th>
              <th className="text-right p-3">Buchungen</th>
              <th className="text-right p-3">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E5]">
            {filtered.map((u) => (
              <tr key={u.id} data-testid={`admin-customer-${u.id}`} className="hover:bg-[#F4F4F4]">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#F4F4F4] text-[#525252] flex items-center justify-center">
                      <UserIcon size={14} />
                    </div>
                    <div className="font-semibold text-[#0A0A0A]">{u.name || "—"}</div>
                  </div>
                </td>
                <td className="p-3 text-[#525252]">{u.email}</td>
                <td className="p-3 text-[#525252]">{u.phone || "—"}</td>
                <td className="p-3 text-[#525252] text-xs">{(u.created_at || "").slice(0, 10)}</td>
                <td className="p-3 text-right font-semibold text-[#0A0A0A]">{u.bookings_count}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    <Link to={`/admin/kunden/${u.id}`}>
                      <Button size="sm" variant="outline" data-testid={`customer-view-${u.id}`}>
                        <Eye size={14} className="mr-1" /> Details
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => del(u)}
                      data-testid={`customer-delete-${u.id}`}
                      title="Kunde löschen"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-[#525252]">Keine Kunden gefunden.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
