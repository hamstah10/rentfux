import { Link } from "react-router-dom";
import { Car, Mail, MapPin, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-[#0A192F] text-slate-200" data-testid="site-footer">
      <div className="rf-container py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-[#0055FF] flex items-center justify-center text-white">
              <Car size={18} />
            </div>
            <span className="font-display font-bold text-xl text-white">RentFux</span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Premium-Autovermietung für Privat- und Geschäftskunden. Transparente Preise, moderne Flotte, faire Konditionen.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3 font-display">Unternehmen</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link to="/ueber-uns" className="hover:text-white" data-testid="foot-about">Über uns</Link></li>
            <li><Link to="/standorte" className="hover:text-white" data-testid="foot-locations">Standorte</Link></li>
            <li><Link to="/katalog" className="hover:text-white" data-testid="foot-fleet">Unsere Flotte</Link></li>
            <li><a href="#" className="hover:text-white">Karriere</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3 font-display">Rechtliches</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><a href="#" className="hover:text-white">AGB</a></li>
            <li><a href="#" className="hover:text-white">Datenschutz</a></li>
            <li><a href="#" className="hover:text-white">Impressum</a></li>
            <li><a href="#" className="hover:text-white">Cookie-Richtlinie</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3 font-display">Kontakt</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-start gap-2"><MapPin size={16} className="mt-0.5" /> Hachmannplatz 16, 20099 Hamburg</li>
            <li className="flex items-center gap-2"><Phone size={16} /> +49 40 123 456 78</li>
            <li className="flex items-center gap-2"><Mail size={16} /> service@rentfux.de</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="rf-container py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} RentFux GmbH · Alle Rechte vorbehalten.</span>
          <span>Mobilität neu gedacht.</span>
        </div>
      </div>
    </footer>
  );
}
