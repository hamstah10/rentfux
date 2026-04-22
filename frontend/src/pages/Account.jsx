import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Car, MapPin, Save, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

const STATUS_MAP = {
  pending: { label: "Ausstehend", cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Bestätigt", cls: "bg-emerald-100 text-emerald-800" },
  active: { label: "Aktiv", cls: "bg-blue-100 text-blue-800" },
  completed: { label: "Abgeschlossen", cls: "bg-slate-100 text-slate-700" },
  cancelled: { label: "Storniert", cls: "bg-red-100 text-red-800" },
};

export default function Account() {
  const { user, updateProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/bookings/me").then((r) => setBookings(r.data)).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, phone });
      toast.success("Profil aktualisiert.");
    } catch (e) {
      toast.error(apiError(e));
    } finally { setSaving(false); }
  };

  return (
    <div className="rf-container py-12 rf-fade-in" data-testid="account-page">
      <div className="mb-10">
        <div className="text-xs tracking-[0.2em] uppercase text-[#0055FF] font-semibold">Mein Konto</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-[#0A192F] mt-1">Hallo, {user?.name || user?.email} 👋</h1>
      </div>

      <Tabs defaultValue="bookings" className="w-full">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="bookings" data-testid="tab-bookings"><Calendar size={14} className="mr-1.5" /> Buchungen</TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile"><UserIcon size={14} className="mr-1.5" /> Profil</TabsTrigger>
        </TabsList>

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

        <TabsContent value="profile" className="mt-6">
          <div className="max-w-xl bg-white border border-slate-200 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label className="mb-1.5 block">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" data-testid="profile-name" />
              </div>
              <div>
                <Label className="mb-1.5 block">Telefon</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" data-testid="profile-phone" />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1.5 block">E-Mail</Label>
                <Input value={user?.email} disabled className="h-11 bg-slate-50" />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="mt-6 bg-[#0055FF] hover:bg-[#0044CC]" data-testid="profile-save">
              <Save size={14} className="mr-2" /> {saving ? "Speichert..." : "Speichern"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="text-slate-500 flex items-center gap-1"><Icon size={11} /> {label}</div>
      <div className="font-semibold text-[#0A192F] truncate">{value}</div>
    </div>
  );
}
