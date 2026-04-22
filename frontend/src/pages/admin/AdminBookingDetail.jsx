import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Ban, Calendar, MapPin, User, Mail, Phone, Car, CreditCard } from "lucide-react";
import { toast } from "sonner";

const STATUSES = [
  { v: "pending", l: "Ausstehend", cls: "bg-amber-100 text-amber-800" },
  { v: "confirmed", l: "Bestätigt", cls: "bg-emerald-100 text-emerald-800" },
  { v: "active", l: "Aktiv", cls: "bg-blue-100 text-blue-800" },
  { v: "completed", l: "Abgeschlossen", cls: "bg-slate-100 text-slate-700" },
  { v: "cancelled", l: "Storniert", cls: "bg-red-100 text-red-800" },
];

const EXTRAS = [
  { id: "Navigation", label: "Navigation", price: 5 },
  { id: "Kindersitz", label: "Kindersitz", price: 7 },
  { id: "Zusatzfahrer", label: "Zusatzfahrer", price: 8 },
  { id: "Vollkasko", label: "Vollkasko-Versicherung", price: 12 },
  { id: "WLAN-Hotspot", label: "WLAN-Hotspot", price: 4 },
];

export default function AdminBookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    const [b, l] = await Promise.all([
      api.get(`/admin/bookings/${id}`),
      api.get("/admin/locations"),
    ]);
    setBooking(b.data);
    setLocations(l.data);
    setForm({
      status: b.data.status,
      start_date: b.data.start_date,
      end_date: b.data.end_date,
      location_id: b.data.location_id,
      customer_note: b.data.customer_note || "",
      extras: b.data.extras || [],
    });
  };

  useEffect(() => { load().catch((e) => toast.error(apiError(e))); }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/admin/bookings/${id}`, form);
      setBooking(data);
      toast.success("Buchung aktualisiert");
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  const cancelBooking = async () => {
    setCancelling(true);
    try {
      const { data } = await api.post(`/admin/bookings/${id}/cancel`);
      setBooking(data);
      setForm((f) => ({ ...f, status: "cancelled" }));
      toast.success("Buchung storniert");
    } catch (e) { toast.error(apiError(e)); }
    finally { setCancelling(false); }
  };

  const toggleExtra = (x) => setForm((f) => ({
    ...f, extras: f.extras.includes(x) ? f.extras.filter((e) => e !== x) : [...f.extras, x],
  }));

  if (!booking || !form) {
    return <div className="text-slate-500">Lädt...</div>;
  }

  const statusMeta = STATUSES.find((s) => s.v === booking.status);
  const isCancelled = booking.status === "cancelled";

  return (
    <div className="rf-fade-in" data-testid="admin-booking-detail">
      <Link to="/admin/buchungen" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0055FF] mb-5" data-testid="back-to-bookings">
        <ArrowLeft size={14} /> Zurück zu allen Buchungen
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-[#0055FF] font-semibold">
            Buchung #{booking.id.slice(0, 8).toUpperCase()}
          </div>
          <h1 className="font-display text-3xl font-bold text-[#0A192F] mt-1">
            {booking.vehicle_brand} {booking.vehicle_name}
          </h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge className={`${statusMeta?.cls} border-0`}>{statusMeta?.l}</Badge>
            <Badge className={booking.payment_status === "paid" ? "bg-emerald-100 text-emerald-800 border-0" : "bg-amber-100 text-amber-800 border-0"}>
              {booking.payment_status === "paid" ? "Bezahlt" : "Nicht bezahlt"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="bg-[#0055FF] hover:bg-[#0044CC]" data-testid="booking-save">
            <Save size={14} className="mr-2" /> {saving ? "Speichert..." : "Änderungen speichern"}
          </Button>
          {!isCancelled && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" data-testid="booking-cancel-btn">
                  <Ban size={14} className="mr-2" /> Stornieren
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Buchung stornieren?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Buchung wird auf „Storniert" gesetzt. Das Fahrzeug wird für den Zeitraum wieder freigegeben.
                    Diese Aktion kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={cancelBooking} disabled={cancelling} className="bg-red-600 hover:bg-red-700" data-testid="booking-cancel-confirm">
                    {cancelling ? "Wird storniert..." : "Ja, stornieren"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Details */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="font-display font-semibold text-lg text-[#0A192F] mb-4">Buchungsdetails</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label className="mb-1.5 block text-xs text-slate-500"><Calendar size={12} className="inline mr-1" /> Abholdatum</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} data-testid="bd-start" />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-slate-500"><Calendar size={12} className="inline mr-1" /> Rückgabedatum</Label>
                <Input type="date" value={form.end_date} min={form.start_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} data-testid="bd-end" />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1.5 block text-xs text-slate-500"><MapPin size={12} className="inline mr-1" /> Standort</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                  <SelectTrigger data-testid="bd-location"><SelectValue /></SelectTrigger>
                  <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1.5 block text-xs text-slate-500">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="bd-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1.5 block text-xs text-slate-500">Anmerkung des Kunden</Label>
                <Textarea rows={3} value={form.customer_note} onChange={(e) => setForm({ ...form, customer_note: e.target.value })} data-testid="bd-note" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="font-display font-semibold text-lg text-[#0A192F] mb-4">Extras</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {EXTRAS.map((e) => (
                <label key={e.id} className={`flex items-center justify-between p-3 rounded-md border cursor-pointer ${
                  form.extras.includes(e.id) ? "border-[#0055FF] bg-[#EFF4FF]" : "border-slate-200"
                }`}>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={form.extras.includes(e.id)} onCheckedChange={() => toggleExtra(e.id)} data-testid={`bd-extra-${e.id}`} />
                    <span className="text-sm font-medium text-[#0A192F]">{e.label}</span>
                  </div>
                  <span className="text-sm text-slate-500">+{e.price}€/Tag</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">Änderungen an Extras oder Daten berechnen die Gesamtsumme automatisch neu.</p>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-display font-semibold text-[#0A192F] mb-4 flex items-center gap-2">
              <User size={16} /> Kunde
            </h3>
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-[#0A192F]">{booking.user_name}</div>
              <div className="text-slate-600 flex items-center gap-1.5"><Mail size={12} /> {booking.user_email}</div>
              <div className="text-xs text-slate-400 font-mono">User-ID: {booking.user_id.slice(0, 8)}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-display font-semibold text-[#0A192F] mb-4 flex items-center gap-2">
              <Car size={16} /> Fahrzeug
            </h3>
            <img src={booking.vehicle_image} alt="" className="w-full aspect-video object-cover rounded-md border border-slate-100 mb-3" />
            <div className="text-xs text-slate-500">{booking.vehicle_brand}</div>
            <div className="font-semibold text-[#0A192F]">{booking.vehicle_name}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="font-display font-semibold text-[#0A192F] mb-4 flex items-center gap-2">
              <CreditCard size={16} /> Zahlung
            </h3>
            <div className="space-y-2 text-sm">
              <Row k="Status" v={booking.payment_status === "paid" ? "Bezahlt" : "Offen"} />
              <Row k="Methode" v={(booking.payment_method || "—").toUpperCase()} />
              <Row k="Tage" v={booking.days} />
              <Row k="Zwischensumme" v={`${booking.subtotal.toFixed(2)}€`} />
              <Row k="Extras" v={`${booking.extras_total.toFixed(2)}€`} />
              <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between">
                <span className="font-semibold text-[#0A192F]">Gesamt</span>
                <span className="font-display font-bold text-xl text-[#0055FF]" data-testid="bd-total">
                  {booking.total.toFixed(2)}€
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 text-xs text-slate-500 space-y-1.5">
            <div>Erstellt: <span className="text-slate-700 font-medium">{(booking.created_at || "").slice(0, 19).replace("T", " ")}</span></div>
            {booking.paid_at && <div>Bezahlt: <span className="text-slate-700 font-medium">{booking.paid_at.slice(0, 19).replace("T", " ")}</span></div>}
            {booking.cancelled_at && <div>Storniert: <span className="text-red-700 font-medium">{booking.cancelled_at.slice(0, 19).replace("T", " ")}</span></div>}
            {booking.updated_at && <div>Zuletzt aktualisiert: <span className="text-slate-700 font-medium">{booking.updated_at.slice(0, 19).replace("T", " ")}</span></div>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{k}</span>
      <span className="text-[#0A192F] font-medium">{v}</span>
    </div>
  );
}
