import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Car, Mail, MapPin, Phone } from "lucide-react";
import { api } from "@/lib/api";

export default function Footer() {
  const [loc, setLoc] = useState(null);

  useEffect(() => {
    api.get("/locations").then((r) => setLoc(r.data[0] || null)).catch(() => {});
  }, []);

  const addressLine = loc ? `${loc.address}, ${loc.postal_code} ${loc.city}` : "";
  const phone = loc?.phone || "";
  const email = loc?.email || "service@rentfux.de";

  return (
    <footer className="mt-24 border-t border-[#262626] bg-[#0A0A0A] text-[#D4D4D4]" data-testid="site-footer">
      <div className="rf-container py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-[#E11226] flex items-center justify-center text-white">
              <Car size={18} />
            </div>
            <span className="font-display font-bold text-xl text-white">RentFux</span>
          </div>
          <p className="text-sm text-[#A3A3A3] leading-relaxed">
            Premium-Autovermietung für Privat- und Geschäftskunden. Transparente Preise, moderne Flotte, faire Konditionen.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3 font-display">Unternehmen</h4>
          <ul className="space-y-2 text-sm text-[#A3A3A3]">
            <li><Link to="/ueber-uns" className="hover:text-white" data-testid="foot-about">Über uns</Link></li>
            <li><Link to="/standorte" className="hover:text-white" data-testid="foot-locations">Standorte</Link></li>
            <li><Link to="/katalog" className="hover:text-white" data-testid="foot-fleet">Unsere Flotte</Link></li>
            <li><a href="#" className="hover:text-white">Karriere</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3 font-display">Rechtliches</h4>
          <ul className="space-y-2 text-sm text-[#A3A3A3]">
            <li><a href="#" className="hover:text-white">AGB</a></li>
            <li><a href="#" className="hover:text-white">Datenschutz</a></li>
            <li><a href="#" className="hover:text-white">Impressum</a></li>
            <li><a href="#" className="hover:text-white">Cookie-Richtlinie</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3 font-display">Kontakt</h4>
          <ul className="space-y-3 text-sm text-[#A3A3A3]">
            {loc?.name && <li className="font-medium text-[#A3A3A3]">{loc.name}</li>}
            {addressLine && (
              <li className="flex items-start gap-2" data-testid="footer-address">
                <MapPin size={16} className="mt-0.5 shrink-0" /> {addressLine}
              </li>
            )}
            {phone && (
              <li className="flex items-center gap-2" data-testid="footer-phone">
                <Phone size={16} /> <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-white">{phone}</a>
              </li>
            )}
            <li className="flex items-center gap-2" data-testid="footer-email">
              <Mail size={16} /> <a href={`mailto:${email}`} className="hover:text-white">{email}</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#262626]">
        <div className="rf-container py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[#525252]">
          <span>© {new Date().getFullYear()} RentFux GmbH · Alle Rechte vorbehalten.</span>
          <span>Mobilität neu gedacht.</span>
        </div>
      </div>
    </footer>
  );
}
