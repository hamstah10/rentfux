import { ShieldCheck, Clock, Euro, Sparkles } from "lucide-react";

export default function About() {
  return (
    <div className="rf-container py-14 rf-fade-in" data-testid="about-page">
      <span className="text-xs tracking-[0.2em] uppercase text-[#E11226] font-semibold">Über RentFux</span>
      <h1 className="font-display text-4xl md:text-5xl font-bold text-[#0A0A0A] mt-1 tracking-tighter">Mobilität neu gedacht.</h1>
      <p className="text-[#525252] mt-4 max-w-2xl text-lg">
        RentFux macht Autovermietung einfach, transparent und digital. Für Privatkunden, die spontan
        unterwegs sein wollen, und für Unternehmen, die auf Zuverlässigkeit setzen.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-14">
        {[
          { icon: ShieldCheck, title: "Sicherheit zuerst", text: "Alle Fahrzeuge werden regelmäßig gewartet und vor jeder Vermietung kontrolliert." },
          { icon: Clock, title: "24/7 Verfügbarkeit", text: "Selbstabholung rund um die Uhr über unsere digitale Station." },
          { icon: Euro, title: "Faire Preise", text: "Transparente All-Inclusive-Tarife ohne versteckte Kosten." },
          { icon: Sparkles, title: "Moderne Flotte", text: "Vom Kleinwagen bis zum Premium-SUV – aktuelle Modelle, immer gepflegt." },
        ].map((f, i) => (
          <div key={i} className="bg-white border border-[#E5E5E5] rounded-lg p-6">
            <div className="w-11 h-11 rounded-lg bg-[#FEE2E5] text-[#E11226] flex items-center justify-center mb-4">
              <f.icon size={20} />
            </div>
            <h3 className="font-display font-semibold text-xl text-[#0A0A0A]">{f.title}</h3>
            <p className="text-[#525252] mt-2">{f.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 bg-[#0A0A0A] rounded-xl p-10 text-white">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { k: "800+", v: "Buchungen / Monat" },
            { k: "8", v: "Fahrzeuge in der Flotte" },
            { k: "4,9★", v: "Kundenbewertung" },
            { k: "24/7", v: "Support & Abholung" },
          ].map((s) => (
            <div key={s.v}>
              <div className="font-display text-4xl font-bold text-[#FB7185]">{s.k}</div>
              <div className="text-[#A3A3A3] mt-1 text-sm">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
