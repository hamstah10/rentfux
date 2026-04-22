import { Link } from "react-router-dom";
import { Users, Gauge, Fuel, Cog } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function VehicleCard({ vehicle }) {
  return (
    <Link
      to={`/fahrzeug/${vehicle.id}`}
      className="group rf-card-hover block bg-white rounded-lg border border-slate-200 overflow-hidden"
      data-testid={`vehicle-card-${vehicle.id}`}
    >
      <div className="aspect-video bg-slate-100 overflow-hidden">
        <img
          src={vehicle.image_url}
          alt={`${vehicle.brand} ${vehicle.name}`}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          loading="lazy"
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">{vehicle.brand}</div>
            <h3 className="font-display font-semibold text-lg text-[#0A192F]">{vehicle.name}</h3>
          </div>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200">
            {vehicle.category}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-5">
          <div className="flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {vehicle.seats} Sitze</div>
          <div className="flex items-center gap-1.5"><Cog size={14} className="text-slate-400" /> {vehicle.transmission}</div>
          <div className="flex items-center gap-1.5"><Fuel size={14} className="text-slate-400" /> {vehicle.fuel}</div>
          <div className="flex items-center gap-1.5"><Gauge size={14} className="text-slate-400" /> {vehicle.doors} Türen</div>
        </div>

        <div className="flex items-end justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">ab</div>
            <div className="font-display font-bold text-2xl text-[#0A192F]">
              {vehicle.price_per_day.toFixed(0)}€
              <span className="text-xs font-normal text-slate-500"> / Tag</span>
            </div>
          </div>
          <span className="text-sm font-semibold text-[#0055FF] group-hover:underline">Details →</span>
        </div>
      </div>
    </Link>
  );
}
