import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Mail, Phone, Calendar, User, Euro, CheckCircle2, XCircle, Clock, Eye, MapPin, IdCard, FileCheck2, Building2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import AdminDocumentCard from "@/components/AdminDocumentCard";

const STATUS = {
  pending: { label: "Ausstehend", cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Bestätigt", cls: "bg-emerald-100 text-emerald-800" },
  active: { label: "Aktiv", cls: "bg-blue-100 text-blue-800" },
  completed: { label: "Abgeschlossen", cls: "bg-slate-100 text-slate-700" },
  cancelled: { label: "Storniert", cls: "bg-red-100 text-red-800" },
};

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get(`/admin/customers/${id}`)
    .then((r) => setData(r.data))
    .catch((e) => toast.error(apiError(e)));

  useEffect(() => { load(); }, [id]);

  const openEdit = () => {
    const u = data.user;
    setForm({
      name: u.name || "", phone: u.phone || "", date_of_birth: u.date_of_birth || "",
      address: { street: "", house_number: "", postal_code: "", city: "", country: "Deutschland", ...(u.address || {}) },
      license_number: u.license_number || "", license_expiry: u.license_expiry || "", id_card_number: u.id_card_number || "",
      is_business: u.is_business || false,
      company: { company_name: "", vat_id: "", contact_person: "", ...(u.company || {}) },
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/customers/${id}`, form);
      toast.success("Kundendaten aktualisiert");
      setEditOpen(false);
      load();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  const setAddr = (k, v) => setForm({ ...form, address: { ...form.address, [k]: v } });
  const setCompany = (k, v) => setForm({ ...form, company: { ...form.company, [k]: v } });

  if (!data) return <div className="text-slate-500">Lädt...</div>;
  const { user, bookings, stats } = data;
  const addr = user.address || {};
  const addrFull = [
    [addr.street, addr.house_number].filter(Boolean).join(" "),
    [addr.postal_code, addr.city].filter(Boolean).join(" "),
    addr.country,
  ].filter(Boolean).join(", ") || "—";
  const docs = user.documents || {};

  return (
    <div className="rf-fade-in" data-testid="admin-customer-detail">
      <Link to="/admin/kunden" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0055FF] mb-5" data-testid="back-to-customers">
        <ArrowLeft size={14} /> Zurück zur Kundenliste
      </Link>

      <div className="flex items-center gap-5 mb-8 flex-wrap">
        <div className="w-20 h-20 rounded-full bg-[#EFF4FF] text-[#0055FF] flex items-center justify-center font-display font-bold text-3xl">
          {(user.name || user.email).slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="text-xs tracking-[0.2em] uppercase text-[#0055FF] font-semibold">Kundenprofil</div>
          <h1 className="font-display text-3xl font-bold text-[#0A192F] mt-1">{user.name || "—"}</h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <div className="text-slate-500 text-sm font-mono">ID: {user.id.slice(0, 8).toUpperCase()}</div>
            {user.is_business && (
              <Badge className="bg-[#EFF4FF] text-[#0055FF] border-0 gap-1">
                <Building2 size={12} /> Geschäftskunde
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={openEdit} className="bg-[#0055FF] hover:bg-[#0044CC]" data-testid="customer-edit-btn">
          <Pencil size={14} className="mr-2" /> Bearbeiten
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-display font-semibold text-[#0A192F] mb-4 flex items-center gap-2">
              <User size={16} /> Kontaktdaten
            </h3>
            <div className="space-y-3 text-sm">
              <InfoRow icon={Mail} label="E-Mail" value={user.email} />
              <InfoRow icon={Phone} label="Telefon" value={user.phone || "—"} />
              <InfoRow icon={Calendar} label="Geburtsdatum" value={user.date_of_birth || "—"} />
              <InfoRow icon={Calendar} label="Registriert" value={(user.created_at || "").slice(0, 10)} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-display font-semibold text-[#0A192F] mb-4 flex items-center gap-2">
              <MapPin size={16} /> Adresse
            </h3>
            <div className="text-sm text-[#0A192F] leading-relaxed">{addrFull}</div>
          </div>

          {user.is_business && (
            <div className="bg-white border border-slate-200 rounded-lg p-6" data-testid="customer-business">
              <h3 className="font-display font-semibold text-[#0A192F] mb-4 flex items-center gap-2">
                <Building2 size={16} /> Firma
              </h3>
              <div className="space-y-3 text-sm">
                <InfoRow icon={Building2} label="Firmenname" value={user.company?.company_name || "—"} />
                <InfoRow icon={FileCheck2} label="USt-IdNr." value={user.company?.vat_id || "—"} />
                <InfoRow icon={User} label="Ansprechpartner" value={user.company?.contact_person || "—"} />
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-display font-semibold text-[#0A192F] mb-4 flex items-center gap-2">
              <IdCard size={16} /> Ausweis-Daten
            </h3>
            <div className="space-y-3 text-sm">
              <InfoRow icon={FileCheck2} label="Führerschein-Nr." value={user.license_number || "—"} />
              <InfoRow icon={Calendar} label="Gültig bis" value={user.license_expiry || "—"} />
              <InfoRow icon={IdCard} label="Personalausweis-Nr." value={user.id_card_number || "—"} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-display font-semibold text-[#0A192F] mb-4">Kennzahlen</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatBox icon={Calendar} label="Buchungen" value={stats.total_bookings} />
              <StatBox icon={Euro} label="Umsatz" value={`${stats.total_spent.toFixed(0)}€`} accent />
              <StatBox icon={Clock} label="Aktiv" value={stats.active} />
              <StatBox icon={CheckCircle2} label="Abgeschlossen" value={stats.completed} />
              <StatBox icon={XCircle} label="Storniert" value={stats.cancelled} />
            </div>
          </div>
        </aside>

        {/* Main */}
        <section className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-display font-semibold text-[#0A192F] mb-4 flex items-center gap-2">
              <FileCheck2 size={16} /> Dokumente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminDocumentCard customerId={user.id} docType="license" meta={docs.license} />
              <AdminDocumentCard customerId={user.id} docType="id_card" meta={docs.id_card} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-display font-semibold text-[#0A192F]">Buchungshistorie ({bookings.length})</h3>
            </div>
            {bookings.length === 0 ? (
              <div className="p-10 text-center text-slate-500">Dieser Kunde hat noch keine Buchungen.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bookings.map((b) => {
                  const s = STATUS[b.status] || STATUS.pending;
                  return (
                    <div key={b.id} className="p-5 flex items-center gap-4 hover:bg-slate-50" data-testid={`cust-booking-${b.id}`}>
                      <img src={b.vehicle_image} alt="" className="w-24 h-16 object-cover rounded-md border border-slate-100 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">{b.vehicle_brand}</div>
                            <div className="font-semibold text-[#0A192F] truncate">{b.vehicle_name}</div>
                          </div>
                          <Badge className={`${s.cls} border-0 shrink-0`}>{s.label}</Badge>
                        </div>
                        <div className="mt-1.5 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-500">
                          <span><Calendar size={11} className="inline mr-1" /> {b.start_date} → {b.end_date}</span>
                          <span>{b.days} Tag{b.days !== 1 && "e"}</span>
                          <span className="font-semibold text-[#0A192F]">{b.total.toFixed(2)}€</span>
                        </div>
                      </div>
                      <Link to={`/admin/buchungen/${b.id}`} className="shrink-0">
                        <Button size="sm" variant="outline" data-testid={`cust-view-booking-${b.id}`}>
                          <Eye size={14} className="mr-1" /> Öffnen
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kundendaten bearbeiten</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Kontakt</div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldLabel label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="ae-name" /></FieldLabel>
                  <FieldLabel label="Telefon"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="ae-phone" /></FieldLabel>
                  <FieldLabel label="Geburtsdatum"><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} data-testid="ae-dob" /></FieldLabel>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Adresse</div>
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-4"><FieldLabel label="Straße"><Input value={form.address.street} onChange={(e) => setAddr("street", e.target.value)} data-testid="ae-street" /></FieldLabel></div>
                  <div className="col-span-2"><FieldLabel label="Hausnr."><Input value={form.address.house_number} onChange={(e) => setAddr("house_number", e.target.value)} data-testid="ae-house" /></FieldLabel></div>
                  <div className="col-span-2"><FieldLabel label="PLZ"><Input value={form.address.postal_code} onChange={(e) => setAddr("postal_code", e.target.value)} data-testid="ae-plz" /></FieldLabel></div>
                  <div className="col-span-4"><FieldLabel label="Stadt"><Input value={form.address.city} onChange={(e) => setAddr("city", e.target.value)} data-testid="ae-city" /></FieldLabel></div>
                  <div className="col-span-6"><FieldLabel label="Land"><Input value={form.address.country} onChange={(e) => setAddr("country", e.target.value)} data-testid="ae-country" /></FieldLabel></div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Führerschein & Ausweis</div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldLabel label="Führerschein-Nr."><Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} data-testid="ae-lic" /></FieldLabel>
                  <FieldLabel label="Gültig bis"><Input type="date" value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} data-testid="ae-lic-exp" /></FieldLabel>
                  <div className="col-span-2"><FieldLabel label="Personalausweis-Nr."><Input value={form.id_card_number} onChange={(e) => setForm({ ...form, id_card_number: e.target.value })} data-testid="ae-idcard" /></FieldLabel></div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Switch checked={form.is_business} onCheckedChange={(v) => setForm({ ...form, is_business: v })} data-testid="ae-biz-toggle" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Geschäftskunde</span>
                </div>
                {form.is_business && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><FieldLabel label="Firmenname"><Input value={form.company.company_name} onChange={(e) => setCompany("company_name", e.target.value)} data-testid="ae-company" /></FieldLabel></div>
                    <FieldLabel label="USt-ID"><Input value={form.company.vat_id} onChange={(e) => setCompany("vat_id", e.target.value)} data-testid="ae-vat" /></FieldLabel>
                    <FieldLabel label="Ansprechpartner"><Input value={form.company.contact_person} onChange={(e) => setCompany("contact_person", e.target.value)} data-testid="ae-contact" /></FieldLabel>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-[#0055FF] hover:bg-[#0044CC]" data-testid="ae-save">
              <Save size={14} className="mr-2" /> {saving ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldLabel({ label, children }) {
  return (<div><Label className="mb-1.5 block text-xs text-slate-500">{label}</Label>{children}</div>);
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-[#0A192F] font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, accent }) {
  return (
    <div className={`rounded-md border p-3 ${accent ? "bg-[#EFF4FF] border-[#DBEAFE]" : "bg-slate-50 border-slate-200"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        <Icon size={11} /> {label}
      </div>
      <div className={`font-display font-bold text-xl mt-1 ${accent ? "text-[#0055FF]" : "text-[#0A192F]"}`}>{value}</div>
    </div>
  );
}
