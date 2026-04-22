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
        <div className="rf-container pt-20 pb-40 md:pt-28 md:pb-48 text-white relative">
          <div className="max-w-2xl">
            <span className="inline-block text-xs tracking-[0.2em] uppercase bg-white/10 border border-white/20 backdrop-blur-md rounded-full px-3 py-1 mb-6">
              Premium Autovermietung · Hamburg
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05]">
              Fahrzeuge für jeden Anlass – <span className="text-[#7FB2FF]">einfach online</span> buchen.
            </h1>
            <p className="mt-5 text-base md:text-lg text-slate-200/90 max-w-xl">
              Vom Kleinwagen für die Stadt bis zum Premium-SUV für die Geschäftsreise.
              Transparente Preise, moderne Flotte, keine versteckten Kosten.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/katalog">
                <Button size="lg" className="bg-[#0055FF] hover:bg-[#0044CC] h-12 px-6" data-testid="hero-cta-catalog">
                  Flotte entdecken <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
              <Link to="/ueber-uns">
                <Button size="lg" variant="outline" className="h-12 px-6 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white" data-testid="hero-cta-about">
                  Mehr über uns
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
              <div className="w-11 h-11 rounded-lg bg-[#EFF4FF] text-[#0055FF] flex items-center justify-center shrink-0">
                <f.icon size={20} />
              </div>
              <div>
                <div className="font-semibold text-[#0A192F]">{f.title}</div>
                <div className="text-sm text-slate-500">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fleet */}
      <section className="rf-container pt-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-xs tracking-[0.2em] uppercase text-[#0055FF] font-semibold">Unsere Flotte</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-1 text-[#0A192F]">Beliebte Fahrzeuge</h2>
          </div>
          <Link to="/katalog" className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-[#0055FF] hover:underline" data-testid="home-view-all">
            Alle anzeigen <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#F8FAFC] mt-20 py-20 border-y border-slate-200">
        <div className="rf-container">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs tracking-[0.2em] uppercase text-[#0055FF] font-semibold">So funktioniert's</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-2 text-[#0A192F]">In vier Schritten zum Fahrzeug</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { n: "01", t: "Fahrzeug wählen", d: "Durchsuche unsere Flotte und filtere nach deinen Wünschen." },
              { n: "02", t: "Zeitraum festlegen", d: "Wähle Abhol- und Rückgabedatum sowie den Standort." },
              { n: "03", t: "Online bezahlen", d: "Sicher mit Kreditkarte oder PayPal bezahlen." },
              { n: "04", t: "Losfahren", d: "Bestätigung per E-Mail & WhatsApp – abholen und los." },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-6" data-testid={`how-step-${i}`}>
                <div className="text-[#0055FF] font-display font-bold text-3xl">{s.n}</div>
                <div className="mt-3 font-semibold text-[#0A192F]">{s.t}</div>
                <div className="mt-1.5 text-sm text-slate-500 leading-relaxed">{s.d}</div>
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
              className="rounded-lg w-full h-80 object-cover border border-slate-200"
            />
          </div>
          <div className="md:col-span-7">
            <div className="flex items-center gap-1 text-[#0055FF] mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
            </div>
            <blockquote className="font-display text-2xl md:text-3xl font-medium text-[#0A192F] leading-tight">
              „Unkomplizierte Buchung, top gepflegtes Fahrzeug und faire Preise. RentFux ist für unsere Geschäftsreisen die erste Wahl."
            </blockquote>
            <div className="mt-5 text-sm text-slate-600">
              <div className="font-semibold">Markus Weber</div>
              <div>Vertriebsleiter · Hanse Consulting GmbH</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
