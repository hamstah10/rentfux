import { useState } from "react";
import { api, apiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tag, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function DiscountInput({ subtotal, onApply, applied }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/bookings/apply-discount", { code: code.trim(), subtotal });
      onApply({ code: data.code, discount: data.discount, type: data.type, value: data.value });
      toast.success(`Rabatt „${data.code}" angewendet`);
      setCode("");
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  const handleRemove = () => {
    onApply(null);
    toast.success("Rabatt entfernt");
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-sm" data-testid="discount-applied">
        <div className="flex items-center gap-2 text-emerald-900">
          <Check size={14} />
          <span className="font-mono font-semibold">{applied.code}</span>
          <span className="text-emerald-700">−{applied.discount.toFixed(2)}€</span>
        </div>
        <button onClick={handleRemove} className="text-emerald-700 hover:text-emerald-900" data-testid="discount-remove">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2" data-testid="discount-input">
      <div className="relative flex-1">
        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
        <Input
          value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Rabattcode" className="pl-9 h-10 uppercase"
          data-testid="discount-code-input"
        />
      </div>
      <Button type="button" size="sm" onClick={handleApply} disabled={loading || !code} variant="outline" data-testid="discount-apply-btn">
        {loading ? "..." : "Einlösen"}
      </Button>
    </div>
  );
}
