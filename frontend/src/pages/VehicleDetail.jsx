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

  if (loading) return <div className="rf-container py-24 text-center text-[#525252]">Lädt...</div>;
  if (!vehicle) return <div className="rf-container py-24 text-center">Fahrzeug nicht gefunden.</div>;

  return (
    <div className="rf-fade-in" data-testid="vehicle-detail-page">
      <div className="rf-container pt-8">
        <Link to="/katalog" className="inline-flex items-center gap-1.5 text-sm text-[#525252] hover:text-[#E11226]" data-testid="back-to-catalog">
          <ArrowLeft size={14} /> Zurück zum Katalog
        </Link>
      </div>

      <div className="rf-container py-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <div className="rounded-lg overflow-hidden border border-[#E5E5E5] bg-[#F4F4F4]">
            <img src={vehicle.image_url} alt={`${vehicle.brand} ${vehicle.name}`} className="w-full aspect-video object-cover" />
          </div>

          <div className="mt-8">
            <Badge variant="secondary" className="bg-[#FEE2E5] text-[#E11226] border border-[#FECDD3]">
              {vehicle.category}
            </Badge>
            <div className="mt-2 text-sm uppercase tracking-wider text-[#525252]">{vehicle.brand}</div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-[#0A0A0A] tracking-tighter">
              {vehicle.name}
            </h1>
            <p className="mt-4 text-[#525252] leading-relaxed max-w-2xl">{vehicle.description}</p>
          </div>

          <div className="mt-10">
            <h2 className="font-display font-semibold text-xl text-[#0A0A0A] mb-4">Spezifikationen</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Spec icon={Users} label="Sitze" value={vehicle.seats} />
              <Spec icon={Cog} label="Getriebe" value={vehicle.transmission} />
              <Spec icon={Fuel} label="Kraftstoff" value={vehicle.fuel} />
              <Spec icon={Gauge} label="Türen" value={vehicle.doors} />
            </div>
          </div>

          {vehicle.features?.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display font-semibold text-xl text-[#0A0A0A] mb-4">Ausstattung</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vehicle.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-[#262626]">
                    <div className="w-5 h-5 rounded-full bg-[#FEE2E5] text-[#E11226] flex items-center justify-center">
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
          <div className="lg:sticky lg:top-24 bg-white border border-[#E5E5E5] rounded-lg p-6 shadow-sm">
            <div className="flex items-end justify-between pb-4 border-b border-[#E5E5E5]">
              <div>
                <div className="text-xs uppercase tracking-wider text-[#525252]">ab</div>
                <div className="font-display text-4xl font-bold text-[#0A0A0A]">
                  {vehicle.price_per_day.toFixed(0)}€
                  <span className="text-sm font-normal text-[#525252]"> / Tag</span>
                </div>
              </div>
              <Badge className="bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 hover:bg-[#10B981]/10">
                Verfügbar
              </Badge>
            </div>

            <ul className="my-5 space-y-2.5 text-sm text-[#262626]">
              <li className="flex items-center gap-2"><Check size={14} className="text-[#E11226]" /> Vollkasko optional</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#E11226]" /> Kostenlose Stornierung bis 24h vorher</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#E11226]" /> 24/7 Support</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-[#E11226]" /> 300 km / Tag inklusive</li>
            </ul>

            <Button
              className="w-full h-12 bg-[#E11226] hover:bg-[#C20E1F] text-base"
              onClick={() => navigate(`/buchen/${vehicle.id}`)}
              data-testid="vehicle-book-btn"
            >
              <Calendar size={16} className="mr-2" /> Jetzt buchen
            </Button>
            <p className="mt-3 text-center text-xs text-[#525252]">Keine Vorauszahlung bis zur Bestätigung.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, label, value }) {
  return (
    <div className="border border-[#E5E5E5] rounded-lg p-4 bg-white">
      <div className="flex items-center gap-2 text-[#525252] text-xs uppercase tracking-wider mb-1.5">
        <Icon size={14} /> {label}
      </div>
      <div className="font-semibold text-[#0A0A0A]">{value}</div>
    </div>
  );
}
