import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Car, Calendar, MapPin, Users, LogOut, ArrowLeft, Tag, Navigation } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/admin", end: true, icon: LayoutDashboard, label: "Dashboard", testid: "admin-nav-dashboard" },
  { to: "/admin/fahrzeuge", icon: Car, label: "Fahrzeuge", testid: "admin-nav-vehicles" },
  { to: "/admin/tracking", icon: Navigation, label: "GPS-Tracking", testid: "admin-nav-tracking" },
  { to: "/admin/buchungen", icon: Calendar, label: "Buchungen", testid: "admin-nav-bookings" },
  { to: "/admin/standorte", icon: MapPin, label: "Standorte", testid: "admin-nav-locations" },
  { to: "/admin/kunden", icon: Users, label: "Kunden", testid: "admin-nav-customers" },
  { to: "/admin/rabatte", icon: Tag, label: "Rabattcodes", testid: "admin-nav-discounts" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="admin-layout">
      <aside className="hidden md:flex md:w-64 bg-white border-r border-[#E5E5E5] flex-col">
        <div className="p-5 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#E11226] flex items-center justify-center text-white">
              <Car size={18} />
            </div>
            <div>
              <div className="font-display font-bold text-[#0A0A0A]">RentFux</div>
              <div className="text-[11px] uppercase tracking-widest text-[#A3A3A3]">Admin</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `rf-side-link ${isActive ? "active" : ""}`}
              data-testid={l.testid}
            >
              <l.icon size={16} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-[#E5E5E5]">
          <div className="px-3 py-2 text-xs">
            <div className="font-semibold text-[#0A0A0A] truncate">{user?.name}</div>
            <div className="text-[#525252] truncate">{user?.email}</div>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/")} data-testid="admin-back-site">
            <ArrowLeft size={14} className="mr-2" /> Zur Webseite
          </Button>
          <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={async () => { await logout(); navigate("/"); }} data-testid="admin-logout">
            <LogOut size={14} className="mr-2" /> Abmelden
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="md:hidden sticky top-0 z-40 bg-white border-b border-[#E5E5E5] px-4 py-3 flex items-center gap-3 overflow-x-auto">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `rf-side-link whitespace-nowrap ${isActive ? "active" : ""}`}>
              <l.icon size={14} /> {l.label}
            </NavLink>
          ))}
        </div>
        <div className="p-6 md:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
