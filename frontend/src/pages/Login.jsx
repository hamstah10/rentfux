import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiError } from "@/lib/api";
import { Car } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, pw);
      toast.success("Willkommen zurück!");
      const redirect = location.state?.from || (u.role === "admin" ? "/admin" : "/");
      navigate(redirect);
    } catch (err) {
      toast.error(apiError(err, "Anmeldung fehlgeschlagen"));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center rf-container py-16 rf-fade-in" data-testid="login-page">
      <div className="w-full max-w-md bg-white border border-[#E5E5E5] rounded-lg p-8 shadow-sm">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[#E11226] flex items-center justify-center text-white"><Car size={18} /></div>
          <span className="font-display font-bold text-xl text-[#0A0A0A]">RentFux</span>
        </Link>
        <h1 className="font-display text-3xl font-bold text-[#0A0A0A]">Willkommen zurück</h1>
        <p className="text-[#525252] mt-1 text-sm">Melde dich mit deinem Konto an.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label className="mb-1.5 block">E-Mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus className="h-11" data-testid="login-email" />
          </div>
          <div>
            <Label className="mb-1.5 block">Passwort</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required className="h-11" data-testid="login-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 bg-[#E11226] hover:bg-[#C20E1F]" data-testid="login-submit">
            {loading ? "Wird angemeldet..." : "Anmelden"}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E5E5E5] text-center text-sm text-[#525252]">
          Noch kein Konto?{" "}
          <Link to="/registrieren" className="text-[#E11226] font-semibold hover:underline" data-testid="login-to-register">Jetzt registrieren</Link>
        </div>
      </div>
    </div>
  );
}
