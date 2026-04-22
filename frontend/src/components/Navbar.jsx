import { Link, NavLink, useNavigate } from "react-router-dom";
import { Car, LogOut, User, Shield, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const navClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${isActive ? "text-[#0055FF]" : "text-slate-700 hover:text-[#0055FF]"}`;

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200" data-testid="site-navbar">
      <div className="rf-container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
          <div className="w-9 h-9 rounded-lg bg-[#0055FF] flex items-center justify-center text-white">
            <Car size={20} />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-[#0A192F]">RentFux</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <NavLink to="/" end className={navClass} data-testid="nav-home">Start</NavLink>
          <NavLink to="/katalog" className={navClass} data-testid="nav-catalog">Fahrzeuge</NavLink>
          <NavLink to="/standorte" className={navClass} data-testid="nav-locations">Standorte</NavLink>
          <NavLink to="/ueber-uns" className={navClass} data-testid="nav-about">Über uns</NavLink>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-slate-300" data-testid="nav-user-menu">
                  <User size={16} className="mr-2" />
                  {user.name || user.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Mein Konto</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/konto")} data-testid="nav-account">
                  <User size={14} className="mr-2" /> Buchungen & Profil
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="nav-admin">
                    <Shield size={14} className="mr-2" /> Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }} data-testid="nav-logout">
                  <LogOut size={14} className="mr-2" /> Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate("/login")} data-testid="nav-login">Anmelden</Button>
              <Button className="bg-[#0055FF] hover:bg-[#0044CC]" onClick={() => navigate("/registrieren")} data-testid="nav-register">
                Konto erstellen
              </Button>
            </>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)} data-testid="nav-mobile-toggle" aria-label="Menü">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="rf-container py-4 flex flex-col gap-3">
            <NavLink to="/" end onClick={() => setOpen(false)} className="py-2" data-testid="mnav-home">Start</NavLink>
            <NavLink to="/katalog" onClick={() => setOpen(false)} className="py-2" data-testid="mnav-catalog">Fahrzeuge</NavLink>
            <NavLink to="/standorte" onClick={() => setOpen(false)} className="py-2" data-testid="mnav-locations">Standorte</NavLink>
            <NavLink to="/ueber-uns" onClick={() => setOpen(false)} className="py-2" data-testid="mnav-about">Über uns</NavLink>
            <div className="border-t border-slate-200 pt-3 flex flex-col gap-2">
              {user ? (
                <>
                  <Button variant="outline" onClick={() => { setOpen(false); navigate("/konto"); }} data-testid="mnav-account">Mein Konto</Button>
                  {user.role === "admin" && (
                    <Button variant="outline" onClick={() => { setOpen(false); navigate("/admin"); }} data-testid="mnav-admin">Admin</Button>
                  )}
                  <Button onClick={async () => { await logout(); setOpen(false); navigate("/"); }} data-testid="mnav-logout">Abmelden</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => { setOpen(false); navigate("/login"); }} data-testid="mnav-login">Anmelden</Button>
                  <Button className="bg-[#0055FF] hover:bg-[#0044CC]" onClick={() => { setOpen(false); navigate("/registrieren"); }} data-testid="mnav-register">Konto erstellen</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
