import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import DocumentUpload from "@/components/DocumentUpload";
import { Car, User, Home, IdCard, FileCheck2, Check, ArrowLeft, ArrowRight, SkipForward, Building2 } from "lucide-react";
import { toast } from "sonner";

const STEPS = ["Persönlich", "Adresse", "Führerschein", "Dokumente", "Fertig"];

const EMPTY_ADDR = { street: "", house_number: "", postal_code: "", city: "", country: "Deutschland" };

export default function ProfileSetup() {
  const { user, updateProfile, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    phone: user?.phone || "",
    date_of_birth: user?.date_of_birth || "",
    address: { ...EMPTY_ADDR, ...(user?.address || {}) },
    license_number: user?.license_number || "",
    license_expiry: user?.license_expiry || "",
    id_card_number: user?.id_card_number || "",
    is_business: user?.is_business || false,
    company: user?.company || { company_name: "", vat_id: "", contact_person: "" },
  });

  const saveAndNext = async () => {
    setSaving(true);
    try {
      await updateProfile(form);
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const setAddr = (key, val) => setForm({ ...form, address: { ...form.address, [key]: val } });

  const skip = () => navigate("/");

  return (
    <div className="min-h-[80vh] bg-[#F8FAFC]" data-testid="profile-setup">
      <div className="rf-container py-12">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-[#E11226] flex items-center justify-center text-white">
            <Car size={20} />
          </div>
          <div>
            <div className="text-xs tracking-[0.2em] uppercase text-[#E11226] font-semibold">RentFux Einrichtung</div>
            <h1 className="font-display text-2xl font-bold text-[#0A0A0A]">Willkommen, {user?.name}! 👋</h1>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-8 bg-white border border-[#E5E5E5] rounded-lg p-5 overflow-x-auto">
          <div className="flex items-center justify-between min-w-max gap-4">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                  i < step ? "bg-[#10B981] text-white" :
                  i === step ? "bg-[#E11226] text-white" :
                  "bg-[#F4F4F4] text-[#A3A3A3]"
                }`}>
                  {i < step ? <Check size={16} /> : i + 1}
                </div>
                <div className={`text-sm font-medium hidden sm:block ${i === step ? "text-[#0A0A0A]" : "text-[#525252]"}`}>{label}</div>
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-[#E5E5E5]" />}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-lg p-6 md:p-10 max-w-3xl mx-auto">
          {/* Step 0: persönlich */}
          {step === 0 && (
            <>
              <StepHeader icon={User} title="Persönliche Daten" sub="Wir benötigen ein paar Basisinformationen zu deiner Person." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Telefon *"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+49 ..." data-testid="wz-phone" /></Field>
                <Field label="Geburtsdatum *"><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} data-testid="wz-dob" /></Field>
              </div>

              <div className="mt-8 pt-6 border-t border-[#E5E5E5]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-[#525252]" />
                    <div className="font-semibold text-[#0A0A0A]">Geschäftskunde?</div>
                  </div>
                  <Switch checked={form.is_business} onCheckedChange={(v) => setForm({ ...form, is_business: v })} data-testid="wz-business-toggle" />
                </div>
                {form.is_business && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="md:col-span-2"><Field label="Firmenname"><Input value={form.company.company_name} onChange={(e) => setForm({ ...form, company: { ...form.company, company_name: e.target.value } })} data-testid="wz-company" /></Field></div>
                    <Field label="USt-IdNr."><Input value={form.company.vat_id} onChange={(e) => setForm({ ...form, company: { ...form.company, vat_id: e.target.value } })} data-testid="wz-vat" /></Field>
                    <Field label="Ansprechpartner"><Input value={form.company.contact_person} onChange={(e) => setForm({ ...form, company: { ...form.company, contact_person: e.target.value } })} data-testid="wz-contact" /></Field>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 1: Adresse */}
          {step === 1 && (
            <>
              <StepHeader icon={Home} title="Deine Adresse" sub="Rechnungs- und Wohnadresse." />
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="md:col-span-4"><Field label="Straße *"><Input value={form.address.street} onChange={(e) => setAddr("street", e.target.value)} data-testid="wz-street" /></Field></div>
                <div className="md:col-span-2"><Field label="Hausnummer *"><Input value={form.address.house_number} onChange={(e) => setAddr("house_number", e.target.value)} data-testid="wz-house" /></Field></div>
                <div className="md:col-span-2"><Field label="PLZ *"><Input value={form.address.postal_code} onChange={(e) => setAddr("postal_code", e.target.value)} data-testid="wz-plz" /></Field></div>
                <div className="md:col-span-4"><Field label="Stadt *"><Input value={form.address.city} onChange={(e) => setAddr("city", e.target.value)} data-testid="wz-city" /></Field></div>
                <div className="md:col-span-6"><Field label="Land"><Input value={form.address.country} onChange={(e) => setAddr("country", e.target.value)} data-testid="wz-country" /></Field></div>
              </div>
            </>
          )}

          {/* Step 2: Führerschein */}
          {step === 2 && (
            <>
              <StepHeader icon={IdCard} title="Führerschein & Ausweis" sub="Die Nummern werden für die Buchung benötigt. Die Dokumente kannst du im nächsten Schritt hochladen." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Führerscheinnummer *"><Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder="B12345678" data-testid="wz-lic" /></Field>
                <Field label="Gültig bis"><Input type="date" value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} data-testid="wz-lic-exp" /></Field>
                <div className="md:col-span-2"><Field label="Personalausweis-Nummer"><Input value={form.id_card_number} onChange={(e) => setForm({ ...form, id_card_number: e.target.value })} data-testid="wz-idcard" /></Field></div>
              </div>
            </>
          )}

          {/* Step 3: Dokumente */}
          {step === 3 && (
            <>
              <StepHeader icon={FileCheck2} title="Dokumente hochladen" sub="Optional – du kannst Dokumente auch später in deinem Konto hinzufügen." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DocumentUpload docType="license" meta={user?.documents?.license} onChanged={refresh} />
                <DocumentUpload docType="id_card" meta={user?.documents?.id_card} onChanged={refresh} />
              </div>
            </>
          )}

          {/* Step 4: Fertig */}
          {step === 4 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/10 text-[#10B981] flex items-center justify-center mx-auto mb-4">
                <Check size={28} />
              </div>
              <h2 className="font-display text-3xl font-bold text-[#0A0A0A]">Alles eingerichtet!</h2>
              <p className="mt-2 text-[#525252]">Dein Konto ist bereit – du kannst jetzt Fahrzeuge buchen.</p>
              <div className="mt-8 flex gap-3 justify-center flex-wrap">
                <Button variant="outline" onClick={() => navigate("/konto")} data-testid="wz-go-account">Zum Konto</Button>
                <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={() => navigate("/katalog")} data-testid="wz-go-catalog">Fahrzeug suchen</Button>
              </div>
            </div>
          )}

          {step < 4 && (
            <div className="mt-10 flex items-center justify-between pt-6 border-t border-[#E5E5E5]">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={back} disabled={step === 0} data-testid="wz-back">
                  <ArrowLeft size={14} className="mr-1" /> Zurück
                </Button>
                <Button variant="ghost" onClick={skip} className="text-[#525252]" data-testid="wz-skip">
                  <SkipForward size={14} className="mr-1" /> Später erledigen
                </Button>
              </div>
              {step === 3 ? (
                <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={next} data-testid="wz-next">
                  Fertigstellen <ArrowRight size={14} className="ml-1" />
                </Button>
              ) : (
                <Button className="bg-[#E11226] hover:bg-[#C20E1F]" onClick={saveAndNext} disabled={saving} data-testid="wz-next">
                  {saving ? "Speichert..." : (<>Weiter <ArrowRight size={14} className="ml-1" /></>)}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeader({ icon: Icon, title, sub }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-[#FEE2E5] text-[#E11226] flex items-center justify-center shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0A0A0A]">{title}</h2>
        <p className="text-[#525252] text-sm mt-1">{sub}</p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><Label className="mb-1.5 block text-xs text-[#525252]">{label}</Label>{children}</div>);
}
