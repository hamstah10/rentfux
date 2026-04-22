import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Calendar, User, Euro, CheckCircle2, XCircle, Clock, Eye, MapPin, IdCard, FileCheck2 } from "lucide-react";
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

  useEffect(() => {
    api.get(`/admin/customers/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => toast.error(apiError(e)));
  }, [id]);

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

      <div className="flex items-center gap-5 mb-8">
        <div className="w-20 h-20 rounded-full bg-[#EFF4FF] text-[#0055FF] flex items-center justify-center font-display font-bold text-3xl">
          {(user.name || user.email).slice(0, 1).toUpperCase()}
        </div>
        <div>
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
    </div>
  );
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
