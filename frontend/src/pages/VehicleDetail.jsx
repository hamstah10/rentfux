import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Gauge, Fuel, Cog, Check, ArrowLeft, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/vehicles/${id}`).then((r) => setVehicle(r.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="rf-container py-24 text-center text-slate-500">Lädt...</div>;
  if (!vehicle) return <div className="rf-container py-24 text-center">Fahrzeug nicht gefunden.</div>;

  return (
    <div className="rf-fade-in" data-testid="vehicle-detail-page">
      <div className="rf-container pt-8">
        <Link to="/katalog" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0055FF]" data-testid="back-to-catalog">
          <ArrowLeft size={14} /> Zurück zum Katalog
        </Link>
      </div>

      <div className="rf-container py-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
            <img src={vehicle.image_url} alt={`${vehicle.brand} ${vehicle.name}`} className="w-full aspect-video object-cover" />
          </div>

          <div className="mt-8">
            <Badge variant="secondary" className="bg-[#EFF4FF] text-[#0055FF] border border-[#DBEAFE]">
              {vehicle.category}
            </Badge>
            <div className="mt-2 text-sm uppercase tracking-wider text-slate-500">{vehicle.brand}</div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-[#0A192F] tracking-tighter">
              {vehicle.name}
            </h1>
            <p className="mt-4 text-slate-600 leading-relaxed max-w-2xl">{vehicle.description}</p>
          </div>

          <div className="mt-10">
            <h2 className="font-display font-semibold text-xl text-[#0A192F] mb-4">Spezifikationen</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Spec icon={Users} label="Sitze" value={vehicle.seats} />
              <Spec icon={Cog} label="Getriebe" value={vehicle.transmission} />
              <Spec icon={Fuel} label="Kraftstoff" value={vehicle.fuel} />
              <Spec icon={Gauge} label="Türen" value={vehicle.doors} />
            </div>
          </div>

          {vehicle.features?.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display font-semibold text-xl text-[#0A192F] mb-4">Ausstattung</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vehicle.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-[#EFF4FF] text-[#0055FF] flex items-center justify-center">
                      <Check size={12} />
                    </div>
                    <span className="text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky booking card */}
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24 bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-end justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">ab</div>
                <div className="font-display text-4xl font-bold text-[#0A192F]">
                  {vehicle.price_per_day.toFixed(0)}€
                  <span className="text-sm font-normal text-slate-500"> / Tag</span>
                </div>
              </div>
              <Badge className="bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 hover:bg-[#10B981]/10">
                Verfügbar
              </Badge>
            </div>

            <ul className="my-5 space-y-2.5 text-sm text-slate-700">
              <li className="flex items-center gap-2"><Check size={14} className="text-[#0055FF]" /> Vollkasko optional</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#0055FF]" /> Kostenlose Stornierung bis 24h vorher</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#0055FF]" /> 24/7 Support</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#0055FF]" /> 300 km / Tag inklusive</li>
            </ul>

            <Button
              className="w-full h-12 bg-[#0055FF] hover:bg-[#0044CC] text-base"
              onClick={() => navigate(`/buchen/${vehicle.id}`)}
              data-testid="vehicle-book-btn"
            >
              <Calendar size={16} className="mr-2" /> Jetzt buchen
            </Button>
            <p className="mt-3 text-center text-xs text-slate-500">Keine Vorauszahlung bis zur Bestätigung.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, label, value }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-1.5">
        <Icon size={14} /> {label}
      </div>
      <div className="font-semibold text-[#0A192F]">{value}</div>
    </div>
  );
}
