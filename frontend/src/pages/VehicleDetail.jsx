import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Gauge, Fuel, Cog, Check, ArrowLeft, ArrowRight, Calendar, MapPin, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { FEATURE_CATALOG } from "@/lib/featureCatalog";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const resolveImg = (u) => (!u ? "" : u.startsWith("/api/") ? BACKEND + u : u);

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get(`/vehicles/${id}`).then((r) => {
      setVehicle(r.data);
      setActiveIdx(0);
    })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const images = useMemo(() => {
    if (!vehicle) return [];
    const list = (vehicle.images && vehicle.images.length > 0) ? vehicle.images : (vehicle.image_url ? [vehicle.image_url] : []);
    return list.map(resolveImg);
  }, [vehicle]);

  const groupedFeatures = useMemo(() => {
    if (!vehicle?.features?.length) return [];
    const f = new Set(vehicle.features);
    const grouped = FEATURE_CATALOG
      .map((g) => ({ group: g.group, items: g.items.filter((i) => f.has(i)) }))
      .filter((g) => g.items.length > 0);
    const known = new Set(FEATURE_CATALOG.flatMap((g) => g.items));
    const custom = vehicle.features.filter((x) => !known.has(x));
    if (custom.length) grouped.push({ group: "Weitere Ausstattung", items: custom });
    return grouped;
  }, [vehicle]);

  if (loading) return <div className="rf-container py-24 text-center text-[#525252]">Lädt...</div>;
  if (!vehicle) return <div className="rf-container py-24 text-center">Fahrzeug nicht gefunden.</div>;

  const next = () => setActiveIdx((i) => (i + 1) % Math.max(images.length, 1));
  const prev = () => setActiveIdx((i) => (i - 1 + Math.max(images.length, 1)) % Math.max(images.length, 1));

  return (
    <div className="rf-fade-in" data-testid="vehicle-detail-page">
      <div className="rf-container pt-8">
        <Link to="/katalog" className="inline-flex items-center gap-1.5 text-sm text-[#525252] hover:text-[#E11226]" data-testid="back-to-catalog">
          <ArrowLeft size={14} /> Zurück zum Katalog
        </Link>
      </div>

      <div className="rf-container py-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          {/* Gallery */}
          <div className="relative rounded-sm overflow-hidden border border-[#E5E5E5] bg-[#F4F4F4] group" data-testid="vehicle-gallery">
            {images.length > 0 ? (
              <img
                src={images[activeIdx]}
                alt={`${vehicle.brand} ${vehicle.name} ${activeIdx + 1}`}
                className="w-full aspect-video object-cover"
                key={images[activeIdx]}
              />
            ) : (
              <div className="w-full aspect-video flex items-center justify-center text-[#A3A3A3]">
                <ImageIcon size={48} />
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/95 hover:bg-white border border-[#E5E5E5] flex items-center justify-center text-[#0A0A0A] rounded-sm shadow-sm transition-opacity opacity-0 group-hover:opacity-100"
                  aria-label="Vorheriges Bild"
                  data-testid="gallery-prev"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/95 hover:bg-white border border-[#E5E5E5] flex items-center justify-center text-[#0A0A0A] rounded-sm shadow-sm transition-opacity opacity-0 group-hover:opacity-100"
                  aria-label="Nächstes Bild"
                  data-testid="gallery-next"
                >
                  <ArrowRight size={16} />
                </button>
                <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-sm rf-readout">
                  {activeIdx + 1} / {images.length}
                </div>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 gap-2" data-testid="vehicle-thumbnails">
              {images.map((src, idx) => (
                <button
                  key={src + idx}
                  onClick={() => setActiveIdx(idx)}
                  className={`aspect-video overflow-hidden rounded-sm border transition ${
                    idx === activeIdx ? "border-[#E11226] ring-2 ring-[#E11226]/30" : "border-[#E5E5E5] hover:border-[#A3A3A3]"
                  }`}
                  data-testid={`thumb-${idx}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-8">
            <Badge variant="secondary" className="bg-[#FEE2E5] text-[#E11226] border border-[#FECDD3]">
              {vehicle.category}
            </Badge>
            <div className="mt-2 text-sm uppercase tracking-wider text-[#525252]">{vehicle.brand}</div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-[#0A0A0A] tracking-tighter">
              {vehicle.name}
            </h1>
            {vehicle.description && (
              <p className="mt-4 text-[#525252] leading-relaxed max-w-2xl">{vehicle.description}</p>
            )}
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

          {groupedFeatures.length > 0 && (
            <div className="mt-10" data-testid="vehicle-features">
              <h2 className="font-display font-semibold text-xl text-[#0A0A0A] mb-4">
                Ausstattung <span className="text-sm font-normal text-[#525252] rf-readout">({vehicle.features.length})</span>
              </h2>
              <div className="space-y-5">
                {groupedFeatures.map((g) => (
                  <div key={g.group}>
                    <div className="text-[10px] uppercase tracking-wider text-[#A3A3A3] mb-2">{g.group}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {g.items.map((f) => (
                        <div key={f} className="flex items-center gap-2 text-[#262626]">
                          <div className="w-5 h-5 rounded-full bg-[#FEE2E5] text-[#E11226] flex items-center justify-center shrink-0">
                            <Check size={12} />
                          </div>
                          <span className="text-sm">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky booking card */}
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24 bg-white border border-[#E5E5E5] rounded-sm p-6">
            <div className="flex items-end justify-between pb-4 border-b border-[#E5E5E5]">
              <div>
                <div className="text-xs uppercase tracking-wider text-[#525252]">ab</div>
                <div className="font-display text-4xl font-bold text-[#0A0A0A] rf-readout">
                  {vehicle.price_per_day.toFixed(0)}€
                  <span className="text-sm font-normal text-[#525252]"> / Tag</span>
                </div>
              </div>
              <Badge className={
                vehicle.active
                  ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 hover:bg-[#10B981]/10"
                  : "bg-[#737373]/10 text-[#525252] border border-[#A3A3A3]/20 hover:bg-[#737373]/10"
              }>
                {vehicle.active ? "Verfügbar" : "Nicht verfügbar"}
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
              disabled={!vehicle.active}
            >
              <Calendar size={16} className="mr-2" /> Jetzt buchen
            </Button>
            <p className="mt-3 text-center text-xs text-[#525252]">Keine Vorauszahlung bis zur Bestätigung.</p>

            {vehicle.location_name && (
              <div className="mt-5 pt-4 border-t border-[#E5E5E5] text-xs text-[#525252]">
                <div className="text-[10px] uppercase tracking-wider text-[#A3A3A3] mb-1 flex items-center gap-1.5">
                  <MapPin size={11} /> Standort
                </div>
                <div className="text-[#0A0A0A] font-semibold">{vehicle.location_name}</div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, label, value }) {
  return (
    <div className="border border-[#E5E5E5] rounded-sm p-4 bg-white">
      <div className="flex items-center gap-2 text-[#525252] text-xs uppercase tracking-wider mb-1.5">
        <Icon size={14} /> {label}
      </div>
      <div className="font-semibold text-[#0A0A0A]">{value}</div>
    </div>
  );
}
