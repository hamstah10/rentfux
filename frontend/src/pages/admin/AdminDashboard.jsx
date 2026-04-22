import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Car, Calendar, Euro, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const STATUS_LABELS = {
  pending: "Ausstehend", confirmed: "Bestätigt", active: "Aktiv",
  completed: "Abgeschlossen", cancelled: "Storniert",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data));
    api.get("/admin/bookings").then((r) => setBookings(r.data.slice(0, 5)));
  }, []);

  return (
    <div data-testid="admin-dashboard" className="rf-fade-in">
      <div className="mb-8">
        <div className="text-xs tracking-[0.2em] uppercase text-[#0055FF] font-semibold">Übersicht</div>
        <h1 className="font-display text-3xl font-bold text-[#0A192F] mt-1">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Euro} label="Umsatz" value={stats ? `${stats.revenue.toFixed(2)}€` : "—"} testid="stat-revenue" />
        <Stat icon={Calendar} label="Buchungen" value={stats?.total_bookings ?? "—"} testid="stat-bookings" />
        <Stat icon={Car} label="Fahrzeuge" value={stats?.vehicles ?? "—"} testid="stat-vehicles" />
        <Stat icon={Users} label="Kunden" value={stats?.customers ?? "—"} testid="stat-customers" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-[#0A192F]">Umsatz (letzte 6 Monate)</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={stats?.monthly_revenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0A192F", border: "none", borderRadius: 8, color: "white" }} />
                <Bar dataKey="revenue" fill="#0055FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(!stats?.monthly_revenue || stats.monthly_revenue.length === 0) && (
            <div className="text-center text-sm text-slate-500 -mt-32 pb-28">Noch keine Umsatzdaten</div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="font-display font-semibold text-[#0A192F] mb-4">Status-Verteilung</h3>
          <div className="space-y-3">
            {Object.entries(stats?.status_counts || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{STATUS_LABELS[k] || k}</span>
                <span className="font-semibold text-[#0A192F]">{v}</span>
              </div>
            ))}
            {(!stats?.status_counts || Object.keys(stats.status_counts).length === 0) && (
              <div className="text-sm text-slate-500">Noch keine Buchungen</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="font-display font-semibold text-[#0A192F] mb-4">Neueste Buchungen</h3>
        {bookings.length === 0 ? (
          <div className="text-sm text-slate-500">Noch keine Buchungen</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {bookings.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-[#0A192F] truncate">{b.vehicle_brand} {b.vehicle_name}</div>
                  <div className="text-xs text-slate-500 truncate">{b.user_name} · {b.user_email}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-[#0A192F]">{b.total.toFixed(2)}€</div>
                  <div className="text-xs text-slate-500">{b.start_date} → {b.end_date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, testid }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid={testid}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
        <Icon size={14} className="text-[#0055FF]" /> {label}
      </div>
      <div className="font-display font-bold text-2xl text-[#0A192F] mt-2">{value}</div>
    </div>
  );
}
