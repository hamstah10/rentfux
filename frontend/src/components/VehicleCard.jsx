import { Link } from "react-router-dom";
import { Users, Gauge, Fuel, Cog } from "lucide-react";

export default function VehicleCard({ vehicle }) {
  return (
    <Link
      to={`/fahrzeug/${vehicle.id}`}
      className="group rf-card-hover block bg-white border border-[#E5E5E5] overflow-hidden rounded-sm"
      data-testid={`vehicle-card-${vehicle.id}`}
    >
      <div className="aspect-video bg-[#F4F4F4] overflow-hidden border-b border-[#E5E5E5]">
        <img
          src={vehicle.image_url}
          alt={`${vehicle.brand} ${vehicle.name}`}
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          loading="lazy"
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="ds-label">{vehicle.brand}</div>
            <h3 className="font-display font-bold text-xl text-[#0A0A0A] uppercase tracking-tight leading-tight mt-0.5">{vehicle.name}</h3>
          </div>
          <span className="ds-mono text-[10px] uppercase font-semibold tracking-wider px-2 py-1 bg-[#F4F4F4] border border-[#E5E5E5] text-[#0A0A0A] rounded-sm">
            {vehicle.category}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-[#525252] mb-5 font-mono">
          <div className="flex items-center gap-1.5"><Users size={13} className="text-[#A3A3A3]" /> {vehicle.seats} Sitze</div>
          <div className="flex items-center gap-1.5"><Cog size={13} className="text-[#A3A3A3]" /> {vehicle.transmission}</div>
          <div className="flex items-center gap-1.5"><Fuel size={13} className="text-[#A3A3A3]" /> {vehicle.fuel}</div>
          <div className="flex items-center gap-1.5"><Gauge size={13} className="text-[#A3A3A3]" /> {vehicle.doors} Türen</div>
        </div>

        <div className="flex items-end justify-between pt-4 border-t border-[#E5E5E5]">
          <div>
            <div className="ds-label">ab / Tag</div>
            <div className="rf-readout font-display font-extrabold text-3xl text-[#0A0A0A] leading-none mt-1">
              {vehicle.price_per_day.toFixed(0)}<span className="text-base font-semibold text-[#525252] ml-0.5">€</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#E11226] group-hover:underline uppercase tracking-wider ds-mono">Details →</span>
        </div>
      </div>
    </Link>
  );
}
