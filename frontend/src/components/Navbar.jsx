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
    `text-sm font-medium transition-colors ${isActive ? "text-[#E11226]" : "text-[#262626] hover:text-[#E11226]"}`;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-[#E5E5E5]" data-testid="site-navbar">
      <div className="rf-container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5" data-testid="nav-logo">
          <div className="w-9 h-9 bg-[#E11226] flex items-center justify-center text-white rounded-sm">
            <Car size={18} strokeWidth={2.2} />
          </div>
          <div className="leading-none">
            <div className="font-display font-extrabold text-lg uppercase tracking-tight text-[#0A0A0A]">RentFux</div>
            <div className="ds-label text-[10px] -mt-0.5">Engineered Mobility</div>
          </div>
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
                <Button variant="outline" className="border-[#D4D4D4]" data-testid="nav-user-menu">
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
              <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={() => navigate("/registrieren")} data-testid="nav-register">
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
        <div className="md:hidden border-t border-[#E5E5E5] bg-white">
          <div className="rf-container py-4 flex flex-col gap-3">
            <NavLink to="/" end onClick={() => setOpen(false)} className="py-2" data-testid="mnav-home">Start</NavLink>
            <NavLink to="/katalog" onClick={() => setOpen(false)} className="py-2" data-testid="mnav-catalog">Fahrzeuge</NavLink>
            <NavLink to="/standorte" onClick={() => setOpen(false)} className="py-2" data-testid="mnav-locations">Standorte</NavLink>
            <NavLink to="/ueber-uns" onClick={() => setOpen(false)} className="py-2" data-testid="mnav-about">Über uns</NavLink>
            <div className="border-t border-[#E5E5E5] pt-3 flex flex-col gap-2">
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
                  <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={() => { setOpen(false); navigate("/registrieren"); }} data-testid="mnav-register">Konto erstellen</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
