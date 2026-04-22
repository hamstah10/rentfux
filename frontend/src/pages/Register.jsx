import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiError } from "@/lib/api";
import { Car } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Passwort muss mind. 6 Zeichen haben.");
    setLoading(true);
    try {
      await register(form);
      toast.success("Konto erstellt! Willkommen bei RentFux.");
      navigate("/");
    } catch (err) {
      toast.error(apiError(err, "Registrierung fehlgeschlagen"));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center rf-container py-16 rf-fade-in" data-testid="register-page">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[#0055FF] flex items-center justify-center text-white"><Car size={18} /></div>
          <span className="font-display font-bold text-xl text-[#0A192F]">RentFux</span>
        </Link>
        <h1 className="font-display text-3xl font-bold text-[#0A192F]">Konto erstellen</h1>
        <p className="text-slate-500 mt-1 text-sm">Buche dein Fahrzeug in wenigen Klicks.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label className="mb-1.5 block">Vollständiger Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-11" data-testid="register-name" />
          </div>
          <div>
            <Label className="mb-1.5 block">E-Mail</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="h-11" data-testid="register-email" />
          </div>
          <div>
            <Label className="mb-1.5 block">Telefon (optional)</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11" placeholder="+49 ..." data-testid="register-phone" />
          </div>
          <div>
            <Label className="mb-1.5 block">Passwort</Label>
            <Input type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="h-11" data-testid="register-password" />
            <p className="text-xs text-slate-500 mt-1">Mindestens 6 Zeichen</p>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 bg-[#0055FF] hover:bg-[#0044CC]" data-testid="register-submit">
            {loading ? "Wird erstellt..." : "Konto erstellen"}
          </Button>
          <p className="text-xs text-slate-500 text-center">
            Mit der Registrierung akzeptierst du unsere AGB und Datenschutzerklärung.
          </p>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 text-center text-sm text-slate-600">
          Bereits registriert?{" "}
          <Link to="/login" className="text-[#0055FF] font-semibold hover:underline" data-testid="register-to-login">Anmelden</Link>
        </div>
      </div>
    </div>
  );
}
