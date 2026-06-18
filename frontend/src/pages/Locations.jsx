import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MapPin, Phone, Mail } from "lucide-react";

export default function Locations() {
  const [locations, setLocations] = useState([]);
  useEffect(() => { api.get("/locations").then((r) => setLocations(r.data)); }, []);

  return (
    <div className="rf-container py-14 rf-fade-in" data-testid="locations-page">
      <span className="text-xs tracking-[0.2em] uppercase text-[#E11226] font-semibold">Standorte</span>
      <h1 className="font-display text-4xl font-bold text-[#0A0A0A] mt-1">Unsere Stationen</h1>
      <p className="text-[#525252] mt-2 max-w-2xl">
        Wir starten in Hamburg – weitere Standorte sind in Planung. Abholung und Rückgabe rund um die Uhr möglich.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        {locations.map((l) => (
          <div key={l.id} className="bg-white border border-[#E5E5E5] rounded-lg p-6 rf-card-hover" data-testid={`location-${l.id}`}>
            <div className="w-10 h-10 rounded-lg bg-[#FEE2E5] text-[#E11226] flex items-center justify-center mb-4">
              <MapPin size={18} />
            </div>
            <h2 className="font-display font-semibold text-xl text-[#0A0A0A]">{l.name}</h2>
            <div className="mt-2 text-sm text-[#525252]">{l.address}, {l.postal_code} {l.city}</div>
            <div className="mt-4 flex flex-col gap-1.5 text-sm text-[#525252]">
              {l.phone && <span className="flex items-center gap-2"><Phone size={14} /> <a href={`tel:${l.phone.replace(/\s+/g, "")}`} className="hover:text-[#E11226]">{l.phone}</a></span>}
              {l.email && <span className="flex items-center gap-2"><Mail size={14} /> <a href={`mailto:${l.email}`} className="hover:text-[#E11226]">{l.email}</a></span>}
            </div>
            <div className="mt-5 pt-4 border-t border-[#E5E5E5] text-xs text-[#525252]">Öffnungszeiten: 24/7 Selbstabholung · Schalter 07:00 – 22:00</div>
          </div>
        ))}
      </div>
    </div>
  );
}
