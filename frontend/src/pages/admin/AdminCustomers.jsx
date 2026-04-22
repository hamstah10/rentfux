import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search, User as UserIcon } from "lucide-react";

export default function AdminCustomers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => { api.get("/admin/customers").then((r) => setItems(r.data)); }, []);

  const filtered = items.filter((u) => {
    if (!q) return true;
    const n = q.toLowerCase();
    return u.email.toLowerCase().includes(n) || (u.name || "").toLowerCase().includes(n);
  });

  return (
    <div data-testid="admin-customers" className="rf-fade-in">
      <div className="mb-6">
        <div className="text-xs tracking-[0.2em] uppercase text-[#0055FF] font-semibold">Kundenverwaltung</div>
        <h1 className="font-display text-3xl font-bold text-[#0A192F] mt-1">Kunden ({items.length})</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche nach Name oder E-Mail..." className="pl-9" data-testid="customer-search" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left p-3">Kunde</th>
              <th className="text-left p-3">E-Mail</th>
              <th className="text-left p-3">Telefon</th>
              <th className="text-left p-3">Registriert</th>
              <th className="text-right p-3">Buchungen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((u) => (
              <tr key={u.id} data-testid={`admin-customer-${u.id}`}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                      <UserIcon size={14} />
                    </div>
                    <div className="font-semibold text-[#0A192F]">{u.name || "—"}</div>
                  </div>
                </td>
                <td className="p-3 text-slate-600">{u.email}</td>
                <td className="p-3 text-slate-600">{u.phone || "—"}</td>
                <td className="p-3 text-slate-500 text-xs">{(u.created_at || "").slice(0, 10)}</td>
                <td className="p-3 text-right font-semibold text-[#0A192F]">{u.bookings_count}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Keine Kunden gefunden.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
