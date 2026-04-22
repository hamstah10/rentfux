import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Car, MapPin, Save, User as UserIcon, FileText, Home, Building2 } from "lucide-react";
import { toast } from "sonner";
import DocumentUpload from "@/components/DocumentUpload";
import { Switch } from "@/components/ui/switch";

const STATUS_MAP = {
  pending: { label: "Ausstehend", cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Bestätigt", cls: "bg-emerald-100 text-emerald-800" },
  active: { label: "Aktiv", cls: "bg-blue-100 text-blue-800" },
  completed: { label: "Abgeschlossen", cls: "bg-slate-100 text-slate-700" },
  cancelled: { label: "Storniert", cls: "bg-red-100 text-red-800" },
};

const EMPTY_ADDR = { street: "", house_number: "", postal_code: "", city: "", country: "Deutschland" };
const EMPTY_COMPANY = { company_name: "", vat_id: "", contact_person: "" };

export default function Account() {
  const { user, updateProfile, refresh } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    date_of_birth: user?.date_of_birth || "",
    address: { ...EMPTY_ADDR, ...(user?.address || {}) },
    license_number: user?.license_number || "",
    license_expiry: user?.license_expiry || "",
    id_card_number: user?.id_card_number || "",
    is_business: user?.is_business || false,
    company: { ...EMPTY_COMPANY, ...(user?.company || {}) },
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        date_of_birth: user.date_of_birth || "",
        address: { ...EMPTY_ADDR, ...(user.address || {}) },
        license_number: user.license_number || "",
        license_expiry: user.license_expiry || "",
        id_card_number: user.id_card_number || "",
        is_business: user.is_business || false,
        company: { ...EMPTY_COMPANY, ...(user.company || {}) },
      });
    }
  }, [user]);

  useEffect(() => {
    api.get("/bookings/me").then((r) => setBookings(r.data)).finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try { await updateProfile(form); toast.success("Profil gespeichert."); }
    catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  const docs = user?.documents || {};
  const profileComplete = Boolean(
    form.name && form.phone && form.date_of_birth &&
    form.address.street && form.address.postal_code && form.address.city &&
    form.license_number && docs.license && docs.id_card
  );

  return (
    <div className="rf-container py-12 rf-fade-in" data-testid="account-page">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-[#0055FF] font-semibold">Mein Konto</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[#0A192F] mt-1">Hallo, {user?.name || user?.email}</h1>
        </div>
        {!profileComplete && (
          <Badge className="bg-amber-100 text-amber-800 border-0 gap-1.5">
            <FileText size={12} /> Profil unvollständig – bitte ergänzen
          </Badge>
        )}
      </div>

      <Tabs defaultValue="bookings" className="w-full">
        <TabsList className="bg-slate-100 flex flex-wrap h-auto">
          <TabsTrigger value="bookings" data-testid="tab-bookings"><Calendar size={14} className="mr-1.5" /> Buchungen</TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile"><UserIcon size={14} className="mr-1.5" /> Profil</TabsTrigger>
          <TabsTrigger value="address" data-testid="tab-address"><Home size={14} className="mr-1.5" /> Adresse</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents"><FileText size={14} className="mr-1.5" /> Dokumente</TabsTrigger>
        </TabsList>

        {/* Bookings */}
        <TabsContent value="bookings" className="mt-6">
          {loading ? (
            <div className="text-slate-500">Lädt...</div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-300 rounded-lg">
              <Car className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <div className="text-slate-600 mb-4">Du hast noch keine Buchungen.</div>
              <Link to="/katalog"><Button className="bg-[#0055FF] hover:bg-[#0044CC]">Jetzt Fahrzeug suchen</Button></Link>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => {
                const s = STATUS_MAP[b.status] || STATUS_MAP.pending;
                return (
                  <div key={b.id} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col md:flex-row gap-4" data-testid={`booking-row-${b.id}`}>
                    <img src={b.vehicle_image} alt="" className="w-full md:w-48 h-36 md:h-28 object-cover rounded-md border border-slate-100" />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-xs text-slate-500">{b.vehicle_brand}</div>
                          <div className="font-display font-semibold text-lg text-[#0A192F]">{b.vehicle_name}</div>
                        </div>
                        <Badge className={`${s.cls} border-0`}>{s.label}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <Info icon={Calendar} label="Abholung" value={b.start_date} />
                        <Info icon={Calendar} label="Rückgabe" value={b.end_date} />
                        <Info icon={MapPin} label="Standort" value={b.location_name} />
                        <Info icon={Car} label="Gesamt" value={`${b.total.toFixed(2)}€`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile" className="mt-6">
          <div className="max-w-2xl bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="font-display font-semibold text-lg text-[#0A192F] mb-5">Persönliche Daten</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="profile-name" /></Field>
              <Field label="Telefon"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+49 ..." data-testid="profile-phone" /></Field>
              <Field label="E-Mail"><Input value={user?.email} disabled className="bg-slate-50" /></Field>
              <Field label="Geburtsdatum"><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} data-testid="profile-dob" /></Field>
              <Field label="Führerscheinnummer"><Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder="z.B. B12345678" data-testid="profile-license" /></Field>
              <Field label="Führerschein gültig bis"><Input type="date" value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} data-testid="profile-license-expiry" /></Field>
              <div className="md:col-span-2">
                <Field label="Personalausweis-Nummer"><Input value={form.id_card_number} onChange={(e) => setForm({ ...form, id_card_number: e.target.value })} data-testid="profile-idcard" /></Field>
              </div>
            </div>
            <Button onClick={saveProfile} disabled={saving} className="mt-6 bg-[#0055FF] hover:bg-[#0044CC]" data-testid="profile-save">
              <Save size={14} className="mr-2" /> {saving ? "Speichert..." : "Speichern"}
            </Button>
          </div>
        </TabsContent>

        {/* Address */}
        <TabsContent value="address" className="mt-6">
          <div className="max-w-2xl bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="font-display font-semibold text-lg text-[#0A192F] mb-5">Rechnungs- & Wohnadresse</h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
              <div className="md:col-span-4"><Field label="Straße"><Input value={form.address.street} onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value } })} data-testid="addr-street" /></Field></div>
              <div className="md:col-span-2"><Field label="Hausnummer"><Input value={form.address.house_number} onChange={(e) => setForm({ ...form, address: { ...form.address, house_number: e.target.value } })} data-testid="addr-house" /></Field></div>
              <div className="md:col-span-2"><Field label="PLZ"><Input value={form.address.postal_code} onChange={(e) => setForm({ ...form, address: { ...form.address, postal_code: e.target.value } })} data-testid="addr-plz" /></Field></div>
              <div className="md:col-span-4"><Field label="Stadt"><Input value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} data-testid="addr-city" /></Field></div>
              <div className="md:col-span-6"><Field label="Land"><Input value={form.address.country} onChange={(e) => setForm({ ...form, address: { ...form.address, country: e.target.value } })} data-testid="addr-country" /></Field></div>
            </div>
            <Button onClick={saveProfile} disabled={saving} className="mt-6 bg-[#0055FF] hover:bg-[#0044CC]" data-testid="addr-save">
              <Save size={14} className="mr-2" /> {saving ? "Speichert..." : "Adresse speichern"}
            </Button>
          </div>
        </TabsContent>

        {/* Business */}
        <TabsContent value="business" className="mt-6">
          <div className="max-w-2xl bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-5 gap-4">
              <div>
                <h2 className="font-display font-semibold text-lg text-[#0A192F]">Geschäftskunde</h2>
                <p className="text-sm text-slate-500 mt-1">Aktiviere diese Option, wenn du im Namen eines Unternehmens buchst.</p>
              </div>
              <Switch
                checked={form.is_business}
                onCheckedChange={(v) => setForm({ ...form, is_business: v })}
                data-testid="biz-toggle"
              />
            </div>
            {form.is_business && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5 border-t border-slate-100">
                <div className="md:col-span-2"><Field label="Firmenname *"><Input value={form.company.company_name} onChange={(e) => setForm({ ...form, company: { ...form.company, company_name: e.target.value } })} data-testid="biz-name" /></Field></div>
                <Field label="USt-IdNr. (USt-ID)"><Input value={form.company.vat_id} onChange={(e) => setForm({ ...form, company: { ...form.company, vat_id: e.target.value } })} placeholder="DE123456789" data-testid="biz-vat" /></Field>
                <Field label="Ansprechpartner"><Input value={form.company.contact_person} onChange={(e) => setForm({ ...form, company: { ...form.company, contact_person: e.target.value } })} data-testid="biz-contact" /></Field>
              </div>
            )}
            <Button onClick={saveProfile} disabled={saving} className="mt-6 bg-[#0055FF] hover:bg-[#0044CC]" data-testid="biz-save">
              <Save size={14} className="mr-2" /> {saving ? "Speichert..." : "Speichern"}
            </Button>
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-6">
          <div className="max-w-2xl">
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-4 text-sm mb-5">
              <strong>Hinweis:</strong> Für die Anmietung benötigen wir einen gültigen Führerschein sowie deinen Personalausweis.
              Beide Dokumente werden verschlüsselt gespeichert.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DocumentUpload docType="license" meta={docs.license} onChanged={refresh} />
              <DocumentUpload docType="id_card" meta={docs.id_card} onChanged={refresh} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><Label className="mb-1.5 block text-xs text-slate-500">{label}</Label>{children}</div>);
}

function Info({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="text-slate-500 flex items-center gap-1"><Icon size={11} /> {label}</div>
      <div className="font-semibold text-[#0A192F] truncate">{value}</div>
    </div>
  );
}
