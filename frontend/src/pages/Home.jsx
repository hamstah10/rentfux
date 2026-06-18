import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Clock, Euro, MapPin, Star, ArrowRight } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import VehicleCard from "@/components/VehicleCard";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [vehicles, setVehicles] = useState([]);
  useEffect(() => {
    api.get("/vehicles").then((r) => setVehicles(r.data.slice(0, 6))).catch(() => {});
  }, []);

  return (
    <div data-testid="home-page" className="rf-fade-in">
      {/* Hero */}
      <section className="relative rf-hero-bg">
        <div className="rf-container pt-24 pb-44 md:pt-32 md:pb-52 text-white relative">
          <div className="max-w-3xl">
            <div className="ds-eyebrow text-[#FB7185] mb-6">// Premium Mietflotte · Hamburg</div>
            <h1 className="ds-display text-5xl sm:text-6xl lg:text-7xl text-white">
              Performance.<br /><span className="text-[#FB7185]">On Demand.</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-neutral-300 max-w-xl leading-relaxed">
              Vom Kompaktwagen für die Stadt bis zum 400-PS-Allradler für die Geschäftsreise.
              Transparente Preise, geprüfte Fahrzeuge, keine versteckten Kosten.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/katalog">
                <Button size="lg" className="bg-[#E11226] hover:bg-[#C20E1F] h-12 px-6 rounded-sm rf-power-glow uppercase tracking-wider font-semibold text-sm" data-testid="hero-cta-catalog">
                  Flotte ansehen <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
              <Link to="/ueber-uns">
                <Button size="lg" variant="outline" className="h-12 px-6 rounded-sm bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white uppercase tracking-wider font-semibold text-sm" data-testid="hero-cta-about">
                  Über uns
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="rf-container relative -mt-24 md:-mt-28 pb-4">
          <SearchBar variant="hero" />
        </div>
      </section>

      {/* Trust */}
      <section className="rf-container pt-20 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: ShieldCheck, title: "Vollkasko möglich", sub: "Schutz ab 12€ / Tag" },
            { icon: Clock, title: "24/7 Abholung", sub: "Selbstabholung rund um die Uhr" },
            { icon: Euro, title: "Transparente Preise", sub: "Keine versteckten Kosten" },
            { icon: MapPin, title: "Zentrale Standorte", sub: "Hamburg Hbf & mehr" },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3" data-testid={`trust-item-${i}`}>
              <div className="w-11 h-11 rounded-lg bg-[#FEE2E5] text-[#E11226] flex items-center justify-center shrink-0">
                <f.icon size={20} />
              </div>
              <div>
                <div className="font-semibold text-[#0A0A0A]">{f.title}</div>
                <div className="text-sm text-[#525252]">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fleet */}
      <section className="rf-container pt-16">
        <div className="flex items-end justify-between mb-8 border-b border-[#E5E5E5] pb-5">
          <div>
            <div className="ds-eyebrow">// Unsere Flotte</div>
            <h2 className="ds-display text-3xl md:text-4xl mt-2 text-[#0A0A0A]">Beliebte Fahrzeuge</h2>
          </div>
          <Link to="/katalog" className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-[#E11226] hover:underline uppercase tracking-wider" data-testid="home-view-all">
            Alle anzeigen <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#F8FAFC] mt-20 py-20 border-y border-[#E5E5E5]">
        <div className="rf-container">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs tracking-[0.2em] uppercase text-[#E11226] font-semibold">So funktioniert's</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-2 text-[#0A0A0A]">In vier Schritten zum Fahrzeug</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { n: "01", t: "Fahrzeug wählen", d: "Durchsuche unsere Flotte und filtere nach deinen Wünschen." },
              { n: "02", t: "Zeitraum festlegen", d: "Wähle Abhol- und Rückgabedatum sowie den Standort." },
              { n: "03", t: "Online bezahlen", d: "Sicher mit Kreditkarte oder PayPal bezahlen." },
              { n: "04", t: "Losfahren", d: "Bestätigung per E-Mail & WhatsApp – abholen und los." },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-lg border border-[#E5E5E5] p-6" data-testid={`how-step-${i}`}>
                <div className="text-[#E11226] font-display font-bold text-3xl">{s.n}</div>
                <div className="mt-3 font-semibold text-[#0A0A0A]">{s.t}</div>
                <div className="mt-1.5 text-sm text-[#525252] leading-relaxed">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="rf-container py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-5">
            <img
              src="https://images.unsplash.com/photo-1758411897888-3ca658535fdf?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
              alt="Innenraum"
              className="rounded-lg w-full h-80 object-cover border border-[#E5E5E5]"
            />
          </div>
          <div className="md:col-span-7">
            <div className="flex items-center gap-1 text-[#E11226] mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
            </div>
            <blockquote className="font-display text-2xl md:text-3xl font-medium text-[#0A0A0A] leading-tight">
              „Unkomplizierte Buchung, top gepflegtes Fahrzeug und faire Preise. RentFux ist für unsere Geschäftsreisen die erste Wahl."
            </blockquote>
            <div className="mt-5 text-sm text-[#525252]">
              <div className="font-semibold">Markus Weber</div>
              <div>Vertriebsleiter · Hanse Consulting GmbH</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
