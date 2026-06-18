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
import { Switch } from "@/components/ui/switch";
import {
  Check, ArrowLeft, ArrowRight, CreditCard, Calendar, MapPin,
  Sparkles, ShieldCheck, AlertTriangle, User, UserPlus, LogIn,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import DiscountInput from "@/components/DiscountInput";
import { API_BASE } from "@/lib/api";

const EXTRAS = [
  { id: "Navigation", label: "Navigation", price: 5 },
  { id: "Kindersitz", label: "Kindersitz", price: 7 },
  { id: "Zusatzfahrer", label: "Zusatzfahrer", price: 8 },
  { id: "Vollkasko", label: "Vollkasko-Versicherung", price: 12 },
  { id: "WLAN-Hotspot", label: "WLAN-Hotspot", price: 4 },
];

const EMPTY_GUEST = {
  email: "", name: "", phone: "", date_of_birth: "",
  address: { street: "", house_number: "", postal_code: "", city: "", country: "Deutschland" },
  license_number: "", license_expiry: "", id_card_number: "",
};

function todayPlus(d) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
}

const STEPS = ["Zeitraum", "Extras", "Kundendaten", "Zahlung", "Bestätigung"];

export default function BookingFlow() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { user, updateProfile, refresh } = useAuth();
  const isGuest = !user;

  const [step, setStep] = useState(0);
  const [vehicle, setVehicle] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [start, setStart] = useState(todayPlus(1));
  const [end, setEnd] = useState(todayPlus(4));
  const [extras, setExtras] = useState([]);
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState("stripe");
  const [booking, setBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Logged-in user inline edit (name + phone)
  const [authedName, setAuthedName] = useState(user?.name || "");
  const [authedPhone, setAuthedPhone] = useState(user?.phone || "");
  const [profileStatus, setProfileStatus] = useState({ complete: true, missing: [] });

  // Guest fields
  const [guest, setGuest] = useState(EMPTY_GUEST);
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const [discount, setDiscount] = useState(null); // {code, discount, type, value}

  useEffect(() => {
    api.get(`/vehicles/${vehicleId}`).then((r) => setVehicle(r.data)).catch((e) => toast.error(apiError(e)));
    api.get("/locations").then((r) => {
      setLocations(r.data);
      if (r.data[0]) setLocationId(r.data[0].id);
    });
  }, [vehicleId]);

  useEffect(() => {
    if (user) {
      api.get("/auth/profile-status").then((r) => setProfileStatus(r.data)).catch(() => {});
      setAuthedName(user.name || "");
      setAuthedPhone(user.phone || "");
    }
  }, [user]);

  const days = Math.max(1, Math.ceil((new Date(end) - new Date(start)) / 86400000));
  const extrasTotal = extras.reduce((s, id) => s + (EXTRAS.find((e) => e.id === id)?.price || 0), 0) * days;
  const subtotal = vehicle ? vehicle.price_per_day * days : 0;
  const gross = subtotal + extrasTotal;
  const discountAmount = discount?.discount || 0;
  const total = Math.max(0, gross - discountAmount);

  const toggleExtra = (id) =>
    setExtras(extras.includes(id) ? extras.filter((x) => x !== id) : [...extras, id]);

  const validateGuest = () => {
    if (!guest.email || !guest.name || !guest.phone || !guest.date_of_birth) return "Bitte alle Pflichtfelder ausfüllen.";
    if (!guest.address.street || !guest.address.house_number || !guest.address.postal_code || !guest.address.city)
      return "Bitte vollständige Adresse angeben.";
    if (!guest.license_number) return "Führerscheinnummer ist erforderlich.";
    return null;
  };

  const goNext = async () => {
    if (step === 0) {
      if (!locationId) return toast.error("Bitte Standort wählen.");
      if (new Date(end) <= new Date(start)) return toast.error("Rückgabedatum muss nach Abholdatum liegen.");
    }
    if (step === 2) {
      if (isGuest) {
        const err = validateGuest();
        if (err) return toast.error(err);
      } else {
        if (!authedName.trim() || !authedPhone.trim()) return toast.error("Name und Telefon sind erforderlich.");
        if (user.name !== authedName || user.phone !== authedPhone) {
          try { await updateProfile({ name: authedName, phone: authedPhone }); } catch {}
        }
      }
    }
    if (step === 3) {
      if (createAccount && password.length < 6) return toast.error("Passwort muss mind. 6 Zeichen haben.");
      await handleSubmit();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (isGuest) {
        const payload = {
          vehicle_id: vehicleId,
          location_id: locationId,
          start_date: start,
          end_date: end,
          extras,
          customer_note: note,
          customer: guest,
          payment_method: payment,
          create_account: createAccount,
          password: createAccount ? password : null,
          discount_code: discount?.code || null,
        };
        const { data } = await api.post("/bookings/guest", payload);
        setBooking(data.booking);
        setAccountCreated(Boolean(data.account_created));
        if (data.account_created) {
          await refresh();
          toast.success("Buchung bestätigt und Konto erstellt!");
        } else {
          toast.success("Buchung bestätigt!");
        }
      } else {
        const { data: b } = await api.post("/bookings", {
          vehicle_id: vehicleId, location_id: locationId, start_date: start, end_date: end,
          extras, customer_note: note, discount_code: discount?.code || null,
        });
        const { data: paid } = await api.post("/payments/mock-pay", { booking_id: b.id, method: payment });
        setBooking(paid);
        toast.success("Buchung bestätigt!");
      }
      setStep(4);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!vehicle) return <div className="rf-container py-24 text-center text-[#525252]">Lädt...</div>;

  const setAddr = (key, val) => setGuest({ ...guest, address: { ...guest.address, [key]: val } });

  return (
    <div className="rf-container py-10 rf-fade-in" data-testid="booking-flow">
      <Link to={`/fahrzeug/${vehicleId}`} className="inline-flex items-center gap-1.5 text-sm text-[#525252] hover:text-[#E11226] mb-6" data-testid="back-to-vehicle">
        <ArrowLeft size={14} /> Zurück
      </Link>

      {isGuest && step < 4 && (
        <div className="mb-6 bg-[#FEE2E5] border border-[#FECDD3] rounded-lg p-4 flex items-center gap-3 flex-wrap" data-testid="guest-banner">
          <User size={18} className="text-[#E11226] shrink-0" />
          <div className="flex-1 text-sm text-[#0A0A0A]">
            <strong>Als Gast buchen</strong> – oder melde dich an, wenn du bereits ein Konto hast.
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate(`/login`, { state: { from: `/buchen/${vehicleId}` } })} data-testid="guest-login-btn">
            <LogIn size={14} className="mr-1.5" /> Anmelden
          </Button>
        </div>
      )}

      {!isGuest && !profileStatus.complete && step < 4 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 flex-wrap" data-testid="profile-warning">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-amber-900">Profil unvollständig</div>
            <div className="text-sm text-amber-800 mt-1">
              Um zu buchen, benötigen wir: <strong>{profileStatus.missing.join(", ")}</strong>.
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-amber-300" onClick={() => navigate("/konto")} data-testid="profile-warning-btn">
            Profil vervollständigen
          </Button>
        </div>
      )}

      {/* Stepper */}
      <div className="mb-10 bg-white border border-[#E5E5E5] rounded-lg p-5">
        <div className="flex items-center justify-between overflow-x-auto">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-3 min-w-fit">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                i < step ? "bg-[#10B981] text-white" :
                i === step ? "bg-[#E11226] text-white" :
                "bg-[#F4F4F4] text-[#A3A3A3]"
              }`}>
                {i < step ? <Check size={16} /> : i + 1}
              </div>
              <div className={`text-sm font-medium ${i === step ? "text-[#0A0A0A]" : "text-[#525252]"}`}>{label}</div>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-[#E5E5E5] mx-2 hidden md:block" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8 bg-white border border-[#E5E5E5] rounded-lg p-6 md:p-8">
          {/* Step 0 — Dates */}
          {step === 0 && (
            <div data-testid="step-dates">
              <h2 className="font-display text-2xl font-bold text-[#0A0A0A] mb-6">Zeitraum & Standort</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <Label className="mb-1.5 block"><MapPin size={12} className="inline mr-1" /> Standort</Label>
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger className="h-11 border-[#D4D4D4]" data-testid="book-location"><SelectValue /></SelectTrigger>
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

          {/* Step 1 — Extras */}
          {step === 1 && (
            <div data-testid="step-extras">
              <h2 className="font-display text-2xl font-bold text-[#0A0A0A] mb-2">Extras hinzufügen</h2>
              <p className="text-[#525252] text-sm mb-6">Optional – alle Preise pro Tag.</p>
              <div className="space-y-3">
                {EXTRAS.map((e) => (
                  <label key={e.id} className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                    extras.includes(e.id) ? "border-[#E11226] bg-[#FEE2E5]" : "border-[#E5E5E5] hover:border-[#D4D4D4]"
                  }`}>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={extras.includes(e.id)} onCheckedChange={() => toggleExtra(e.id)} data-testid={`extra-${e.id}`} />
                      <div>
                        <div className="font-semibold text-[#0A0A0A]">{e.label}</div>
                        <div className="text-xs text-[#525252] flex items-center gap-1"><Sparkles size={11} /> Komfort-Upgrade</div>
                      </div>
                    </div>
                    <div className="font-display font-bold text-[#E11226]">+{e.price}€<span className="text-xs font-normal text-[#525252]">/Tag</span></div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Customer Data */}
          {step === 2 && isGuest && (
            <div data-testid="step-customer-guest">
              <h2 className="font-display text-2xl font-bold text-[#0A0A0A] mb-2">Deine Daten</h2>
              <p className="text-[#525252] text-sm mb-6">Diese Angaben benötigen wir für die Anmietung.</p>

              <h3 className="font-display font-semibold text-[#0A0A0A] mb-3">Kontakt</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Field label="Vollständiger Name *"><Input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} data-testid="g-name" /></Field>
                <Field label="E-Mail *"><Input type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} data-testid="g-email" /></Field>
                <Field label="Telefon *"><Input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder="+49 ..." data-testid="g-phone" /></Field>
                <Field label="Geburtsdatum *"><Input type="date" value={guest.date_of_birth} onChange={(e) => setGuest({ ...guest, date_of_birth: e.target.value })} data-testid="g-dob" /></Field>
              </div>

              <h3 className="font-display font-semibold text-[#0A0A0A] mb-3">Adresse</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
                <div className="md:col-span-4"><Field label="Straße *"><Input value={guest.address.street} onChange={(e) => setAddr("street", e.target.value)} data-testid="g-street" /></Field></div>
                <div className="md:col-span-2"><Field label="Hausnummer *"><Input value={guest.address.house_number} onChange={(e) => setAddr("house_number", e.target.value)} data-testid="g-house" /></Field></div>
                <div className="md:col-span-2"><Field label="PLZ *"><Input value={guest.address.postal_code} onChange={(e) => setAddr("postal_code", e.target.value)} data-testid="g-plz" /></Field></div>
                <div className="md:col-span-4"><Field label="Stadt *"><Input value={guest.address.city} onChange={(e) => setAddr("city", e.target.value)} data-testid="g-city" /></Field></div>
                <div className="md:col-span-6"><Field label="Land"><Input value={guest.address.country} onChange={(e) => setAddr("country", e.target.value)} data-testid="g-country" /></Field></div>
              </div>

              <h3 className="font-display font-semibold text-[#0A0A0A] mb-3">Führerschein & Ausweis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Field label="Führerscheinnummer *"><Input value={guest.license_number} onChange={(e) => setGuest({ ...guest, license_number: e.target.value })} placeholder="z.B. B12345678" data-testid="g-lic-num" /></Field>
                <Field label="Führerschein gültig bis"><Input type="date" value={guest.license_expiry} onChange={(e) => setGuest({ ...guest, license_expiry: e.target.value })} data-testid="g-lic-exp" /></Field>
                <div className="md:col-span-2"><Field label="Personalausweis-Nr."><Input value={guest.id_card_number} onChange={(e) => setGuest({ ...guest, id_card_number: e.target.value })} data-testid="g-idcard" /></Field></div>
              </div>

              <Field label="Anmerkung (optional)">
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} data-testid="g-note" />
              </Field>

              <p className="text-xs text-[#525252] mt-4">
                Originaldokumente bringst du bitte bei der Abholung mit. Du kannst sie optional auch später in deinem Konto hochladen.
              </p>
            </div>
          )}

          {step === 2 && !isGuest && (
            <div data-testid="step-customer-user">
              <h2 className="font-display text-2xl font-bold text-[#0A0A0A] mb-6">Kundendaten</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Name"><Input value={authedName} onChange={(e) => setAuthedName(e.target.value)} className="h-11" data-testid="book-name" /></Field>
                <Field label="Telefon"><Input value={authedPhone} onChange={(e) => setAuthedPhone(e.target.value)} placeholder="+49 ..." className="h-11" data-testid="book-phone" /></Field>
                <div className="md:col-span-2">
                  <Field label="E-Mail"><Input value={user?.email || ""} disabled className="h-11 bg-[#F4F4F4]" /></Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Anmerkung (optional)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} data-testid="book-note" /></Field>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Payment */}
          {step === 3 && (
            <div data-testid="step-payment">
              <h2 className="font-display text-2xl font-bold text-[#0A0A0A] mb-2">Zahlungsmethode wählen</h2>
              <p className="text-[#525252] text-sm mb-6 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#10B981]" /> Sichere Zahlung – SSL-verschlüsselt.
              </p>
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 text-xs mb-5">
                <strong>Demo-Modus:</strong> Zahlungen sind aktuell simuliert (MOCKED). Es wird kein Geld abgebucht.
              </div>
              <RadioGroup value={payment} onValueChange={setPayment} className="space-y-3">
                <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer ${payment === "stripe" ? "border-[#E11226] bg-[#FEE2E5]" : "border-[#E5E5E5]"}`}>
                  <RadioGroupItem value="stripe" id="pay-stripe" data-testid="pay-stripe" />
                  <CreditCard size={22} className="text-[#E11226]" />
                  <div>
                    <div className="font-semibold text-[#0A0A0A]">Kreditkarte</div>
                    <div className="text-xs text-[#525252]">Visa, Mastercard, Amex</div>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer ${payment === "paypal" ? "border-[#E11226] bg-[#FEE2E5]" : "border-[#E5E5E5]"}`}>
                  <RadioGroupItem value="paypal" id="pay-paypal" data-testid="pay-paypal" />
                  <div className="w-6 h-6 bg-[#003087] text-white rounded flex items-center justify-center text-[10px] font-bold">Pa</div>
                  <div>
                    <div className="font-semibold text-[#0A0A0A]">PayPal</div>
                    <div className="text-xs text-[#525252]">Bezahlen mit deinem PayPal-Konto</div>
                  </div>
                </label>
              </RadioGroup>

              {isGuest && (
                <div className="mt-8 pt-6 border-t border-[#E5E5E5]" data-testid="create-account-block">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#FEE2E5] text-[#E11226] flex items-center justify-center">
                        <UserPlus size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-[#0A0A0A]">Kundenkonto erstellen?</div>
                        <div className="text-sm text-[#525252]">Speichert deine Daten für zukünftige Buchungen. Du kannst Dokumente hochladen und deine Buchungshistorie sehen.</div>
                      </div>
                    </div>
                    <Switch checked={createAccount} onCheckedChange={setCreateAccount} data-testid="create-account-toggle" />
                  </div>
                  {createAccount && (
                    <div className="mt-4">
                      <Field label="Passwort wählen (mind. 6 Zeichen)">
                        <Input
                          type="password" minLength={6}
                          value={password} onChange={(e) => setPassword(e.target.value)}
                          className="h-11" data-testid="create-account-password"
                          placeholder="••••••••"
                        />
                      </Field>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Confirmation */}
          {step === 4 && booking && (
            <div data-testid="step-confirmation" className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/10 text-[#10B981] flex items-center justify-center mx-auto mb-4">
                <Check size={28} />
              </div>
              <h2 className="font-display text-3xl font-bold text-[#0A0A0A]">Buchung bestätigt!</h2>
              <p className="mt-2 text-[#525252]">Buchungsnummer: <span className="font-mono font-semibold">{booking.id.slice(0, 8).toUpperCase()}</span></p>
              <p className="mt-1 text-sm text-[#525252]">Bestätigung per E-Mail & WhatsApp versendet (MOCKED).</p>

              {accountCreated && (
                <div className="mt-6 max-w-md mx-auto bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-4 text-sm" data-testid="account-created-msg">
                  Dein Kundenkonto wurde erfolgreich erstellt. Du bist automatisch angemeldet.
                </div>
              )}

              <div className="mt-8 text-left max-w-md mx-auto bg-[#F4F4F4] rounded-lg p-5 border border-[#E5E5E5] space-y-2 text-sm">
                <Row k="Fahrzeug" v={`${booking.vehicle_brand} ${booking.vehicle_name}`} />
                <Row k="Zeitraum" v={`${booking.start_date} → ${booking.end_date}`} />
                <Row k="Tage" v={booking.days} />
                <Row k="Standort" v={booking.location_name} />
                <Row k="Gesamt" v={`${booking.total.toFixed(2)}€`} strong />
              </div>

              <div className="mt-8 flex gap-3 justify-center flex-wrap">
                <Button variant="outline" onClick={() => navigate("/katalog")} data-testid="conf-back-catalog">Weitere Fahrzeuge</Button>
                {(user || accountCreated) && (
                  <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={() => navigate("/konto")} data-testid="conf-go-account">Meine Buchungen</Button>
                )}
              </div>
            </div>
          )}

          {step < 4 && (
            <div className="mt-8 flex items-center justify-between pt-6 border-t border-[#E5E5E5]">
              <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} data-testid="step-back">
                <ArrowLeft size={14} className="mr-1" /> Zurück
              </Button>
              <Button
                className="bg-[#E11226] hover:bg-[#C20E1F]"
                onClick={goNext}
                disabled={submitting || (step === 3 && !isGuest && !profileStatus.complete)}
                data-testid="step-next"
              >
                {step === 3
                  ? (submitting ? "Wird verarbeitet..." : `Jetzt zahlen · ${total.toFixed(2)}€`)
                  : (<>Weiter <ArrowRight size={14} className="ml-1" /></>)}
              </Button>
            </div>
          )}
        </section>

        {/* Summary */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 bg-white border border-[#E5E5E5] rounded-lg p-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E5E5E5]">
              <img src={vehicle.image_url} alt="" className="w-20 h-16 object-cover rounded-md border border-[#E5E5E5]" />
              <div>
                <div className="text-xs text-[#525252]">{vehicle.brand}</div>
                <div className="font-display font-semibold text-[#0A0A0A]">{vehicle.name}</div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <Row k={`${vehicle.price_per_day}€ × ${days} Tag${days > 1 ? "e" : ""}`} v={`${subtotal.toFixed(2)}€`} />
              {extras.map((id) => {
                const e = EXTRAS.find((x) => x.id === id);
                return <Row key={id} k={`${e.label} (${days}×)`} v={`${(e.price * days).toFixed(2)}€`} muted />;
              })}
              {discountAmount > 0 && (
                <Row k={`Rabatt (${discount.code})`} v={`−${discountAmount.toFixed(2)}€`} accent />
              )}
              <div className="pt-3 mt-3 border-t border-[#E5E5E5] flex items-center justify-between">
                <span className="font-semibold text-[#0A0A0A]">Gesamt</span>
                <span className="font-display font-bold text-2xl text-[#E11226]" data-testid="book-total">{total.toFixed(2)}€</span>
              </div>
            </div>

            {step < 4 && (
              <div className="mt-5 pt-4 border-t border-[#E5E5E5]">
                <div className="text-xs uppercase tracking-wider text-[#525252] mb-2">Rabattcode</div>
                <DiscountInput subtotal={gross} applied={discount} onApply={setDiscount} />
              </div>
            )}

            {step === 4 && booking && (
              <a
                href={`${API_BASE}/bookings/${booking.id}/invoice`}
                target="_blank" rel="noreferrer"
                className="mt-5 w-full inline-flex items-center justify-center gap-2 h-10 rounded-md border border-[#D4D4D4] hover:bg-[#F4F4F4] text-sm font-semibold text-[#0A0A0A]"
                data-testid="invoice-download"
              >
                Rechnung als PDF herunterladen
              </a>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><Label className="mb-1.5 block text-xs text-[#525252]">{label}</Label>{children}</div>);
}

function Row({ k, v, strong, muted, accent }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-[#525252]" : accent ? "text-emerald-700 font-medium" : "text-[#525252]"}>{k}</span>
      <span className={strong ? "font-bold text-[#0A0A0A]" : accent ? "text-emerald-700 font-semibold" : "text-[#0A0A0A] font-medium"}>{v}</span>
    </div>
  );
}
