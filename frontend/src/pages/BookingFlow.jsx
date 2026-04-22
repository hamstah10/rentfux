import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, ArrowLeft, ArrowRight, CreditCard, Calendar, MapPin, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const EXTRAS = [
  { id: "Navigation", label: "Navigation", price: 5 },
  { id: "Kindersitz", label: "Kindersitz", price: 7 },
  { id: "Zusatzfahrer", label: "Zusatzfahrer", price: 8 },
  { id: "Vollkasko", label: "Vollkasko-Versicherung", price: 12 },
  { id: "WLAN-Hotspot", label: "WLAN-Hotspot", price: 4 },
];

function todayPlus(d) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
}

const STEPS = ["Zeitraum", "Extras", "Kundendaten", "Zahlung", "Bestätigung"];

export default function BookingFlow() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [vehicle, setVehicle] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [start, setStart] = useState(todayPlus(1));
  const [end, setEnd] = useState(todayPlus(4));
  const [extras, setExtras] = useState([]);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState("stripe");
  const [booking, setBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/vehicles/${vehicleId}`).then((r) => setVehicle(r.data)).catch((e) => toast.error(apiError(e)));
    api.get("/locations").then((r) => {
      setLocations(r.data);
      if (r.data[0]) setLocationId(r.data[0].id);
    });
  }, [vehicleId]);

  const days = Math.max(1, Math.ceil((new Date(end) - new Date(start)) / 86400000));
  const extrasTotal = extras.reduce((s, id) => s + (EXTRAS.find((e) => e.id === id)?.price || 0), 0) * days;
  const subtotal = vehicle ? vehicle.price_per_day * days : 0;
  const total = subtotal + extrasTotal;

  const toggleExtra = (id) =>
    setExtras(extras.includes(id) ? extras.filter((x) => x !== id) : [...extras, id]);

  const goNext = async () => {
    if (step === 0) {
      if (!locationId) return toast.error("Bitte Standort wählen.");
      if (new Date(end) <= new Date(start)) return toast.error("Rückgabedatum muss nach Abholdatum liegen.");
    }
    if (step === 2) {
      if (!name.trim()) return toast.error("Name ist erforderlich.");
      if (!phone.trim()) return toast.error("Telefonnummer ist erforderlich.");
      if (user && (user.name !== name || user.phone !== phone)) {
        try { await updateProfile({ name, phone }); } catch {}
      }
    }
    if (step === 3) {
      await handlePayment();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handlePayment = async () => {
    try {
      setSubmitting(true);
      const { data: b } = await api.post("/bookings", {
        vehicle_id: vehicleId,
        location_id: locationId,
        start_date: start,
        end_date: end,
        extras,
        customer_note: note,
      });
      const { data: paid } = await api.post("/payments/mock-pay", {
        booking_id: b.id,
        method: payment,
      });
      setBooking(paid);
      setStep(4);
      toast.success("Buchung bestätigt!");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!vehicle) return <div className="rf-container py-24 text-center text-slate-500">Lädt...</div>;

  return (
    <div className="rf-container py-10 rf-fade-in" data-testid="booking-flow">
      <Link to={`/fahrzeug/${vehicleId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0055FF] mb-6" data-testid="back-to-vehicle">
        <ArrowLeft size={14} /> Zurück
      </Link>

      {/* Stepper */}
      <div className="mb-10 bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between overflow-x-auto">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-3 min-w-fit">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                i < step ? "bg-[#10B981] text-white" :
                i === step ? "bg-[#0055FF] text-white" :
                "bg-slate-100 text-slate-400"
              }`}>
                {i < step ? <Check size={16} /> : i + 1}
              </div>
              <div className={`text-sm font-medium ${i === step ? "text-[#0A192F]" : "text-slate-500"}`}>{label}</div>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-200 mx-2 hidden md:block" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Step Content */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6 md:p-8">
          {step === 0 && (
            <div data-testid="step-dates">
              <h2 className="font-display text-2xl font-bold text-[#0A192F] mb-6">Zeitraum & Standort</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <Label className="mb-1.5 block"><MapPin size={12} className="inline mr-1" /> Standort</Label>
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger className="h-11 border-slate-300" data-testid="book-location"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block"><Calendar size={12} className="inline mr-1" /> Abholdatum</Label>
                  <Input type="date" value={start} min={todayPlus(0)} onChange={(e) => setStart(e.target.value)} className="h-11" data-testid="book-start" />
                </div>
                <div>
                  <Label className="mb-1.5 block"><Calendar size={12} className="inline mr-1" /> Rückgabedatum</Label>
                  <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="h-11" data-testid="book-end" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div data-testid="step-extras">
              <h2 className="font-display text-2xl font-bold text-[#0A192F] mb-2">Extras hinzufügen</h2>
              <p className="text-slate-500 text-sm mb-6">Optional – alle Preise pro Tag.</p>
              <div className="space-y-3">
                {EXTRAS.map((e) => (
                  <label key={e.id} className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                    extras.includes(e.id) ? "border-[#0055FF] bg-[#EFF4FF]" : "border-slate-200 hover:border-slate-300"
                  }`}>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={extras.includes(e.id)} onCheckedChange={() => toggleExtra(e.id)} data-testid={`extra-${e.id}`} />
                      <div>
                        <div className="font-semibold text-[#0A192F]">{e.label}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1"><Sparkles size={11} /> Komfort-Upgrade</div>
                      </div>
                    </div>
                    <div className="font-display font-bold text-[#0055FF]">+{e.price}€<span className="text-xs font-normal text-slate-500">/Tag</span></div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div data-testid="step-customer">
              <h2 className="font-display text-2xl font-bold text-[#0A192F] mb-6">Kundendaten</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label className="mb-1.5 block">Vollständiger Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" data-testid="book-name" />
                </div>
                <div>
                  <Label className="mb-1.5 block">Telefonnummer</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 ..." className="h-11" data-testid="book-phone" />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1.5 block">E-Mail</Label>
                  <Input value={user?.email || ""} disabled className="h-11 bg-slate-50" />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1.5 block">Anmerkung (optional)</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} data-testid="book-note" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div data-testid="step-payment">
              <h2 className="font-display text-2xl font-bold text-[#0A192F] mb-2">Zahlungsmethode wählen</h2>
              <p className="text-slate-500 text-sm mb-6 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#10B981]" /> Sichere Zahlung – SSL-verschlüsselt.
              </p>
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 text-xs mb-5">
                <strong>Demo-Modus:</strong> Zahlungen sind aktuell simuliert (MOCKED). Es wird kein Geld abgebucht.
              </div>
              <RadioGroup value={payment} onValueChange={setPayment} className="space-y-3">
                <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer ${payment === "stripe" ? "border-[#0055FF] bg-[#EFF4FF]" : "border-slate-200"}`}>
                  <RadioGroupItem value="stripe" id="pay-stripe" data-testid="pay-stripe" />
                  <CreditCard size={22} className="text-[#0055FF]" />
                  <div>
                    <div className="font-semibold text-[#0A192F]">Kreditkarte</div>
                    <div className="text-xs text-slate-500">Visa, Mastercard, Amex</div>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer ${payment === "paypal" ? "border-[#0055FF] bg-[#EFF4FF]" : "border-slate-200"}`}>
                  <RadioGroupItem value="paypal" id="pay-paypal" data-testid="pay-paypal" />
                  <div className="w-6 h-6 bg-[#003087] text-white rounded flex items-center justify-center text-[10px] font-bold">Pa</div>
                  <div>
                    <div className="font-semibold text-[#0A192F]">PayPal</div>
                    <div className="text-xs text-slate-500">Bezahlen mit deinem PayPal-Konto</div>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          {step === 4 && booking && (
            <div data-testid="step-confirmation" className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/10 text-[#10B981] flex items-center justify-center mx-auto mb-4">
                <Check size={28} />
              </div>
              <h2 className="font-display text-3xl font-bold text-[#0A192F]">Buchung bestätigt!</h2>
              <p className="mt-2 text-slate-600">Buchungsnummer: <span className="font-mono font-semibold">{booking.id.slice(0, 8).toUpperCase()}</span></p>
              <p className="mt-1 text-sm text-slate-500">Bestätigung per E-Mail & WhatsApp versendet (MOCKED).</p>

              <div className="mt-8 text-left max-w-md mx-auto bg-slate-50 rounded-lg p-5 border border-slate-200 space-y-2 text-sm">
                <Row k="Fahrzeug" v={`${booking.vehicle_brand} ${booking.vehicle_name}`} />
                <Row k="Zeitraum" v={`${booking.start_date} → ${booking.end_date}`} />
                <Row k="Tage" v={booking.days} />
                <Row k="Standort" v={booking.location_name} />
                <Row k="Gesamt" v={`${booking.total.toFixed(2)}€`} strong />
              </div>

              <div className="mt-8 flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate("/katalog")} data-testid="conf-back-catalog">Weitere Fahrzeuge</Button>
                <Button className="bg-[#0055FF] hover:bg-[#0044CC]" onClick={() => navigate("/konto")} data-testid="conf-go-account">Meine Buchungen</Button>
              </div>
            </div>
          )}

          {step < 4 && (
            <div className="mt-8 flex items-center justify-between pt-6 border-t border-slate-100">
              <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} data-testid="step-back">
                <ArrowLeft size={14} className="mr-1" /> Zurück
              </Button>
              <Button className="bg-[#0055FF] hover:bg-[#0044CC]" onClick={goNext} disabled={submitting} data-testid="step-next">
                {step === 3 ? (submitting ? "Wird verarbeitet..." : `Jetzt zahlen · ${total.toFixed(2)}€`) : (<>Weiter <ArrowRight size={14} className="ml-1" /></>)}
              </Button>
            </div>
          )}
        </section>

        {/* Summary */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <img src={vehicle.image_url} alt="" className="w-20 h-16 object-cover rounded-md border border-slate-100" />
              <div>
                <div className="text-xs text-slate-500">{vehicle.brand}</div>
                <div className="font-display font-semibold text-[#0A192F]">{vehicle.name}</div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <Row k={`${vehicle.price_per_day}€ × ${days} Tag${days > 1 ? "e" : ""}`} v={`${subtotal.toFixed(2)}€`} />
              {extras.map((id) => {
                const e = EXTRAS.find((x) => x.id === id);
                return <Row key={id} k={`${e.label} (${days}×)`} v={`${(e.price * days).toFixed(2)}€`} muted />;
              })}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="font-semibold text-[#0A192F]">Gesamt</span>
                <span className="font-display font-bold text-2xl text-[#0055FF]" data-testid="book-total">{total.toFixed(2)}€</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v, strong, muted }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-500" : "text-slate-600"}>{k}</span>
      <span className={strong ? "font-bold text-[#0A192F]" : "text-[#0A192F] font-medium"}>{v}</span>
    </div>
  );
}
