import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SearchBar({ variant = "hero" }) {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [start, setStart] = useState(todayPlus(1));
  const [end, setEnd] = useState(todayPlus(4));

  useEffect(() => {
    api.get("/locations").then((r) => {
      setLocations(r.data);
      if (r.data[0]) setLocationId(r.data[0].id);
    }).catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams({ location: locationId, start, end });
    navigate(`/katalog?${params.toString()}`);
  };

  const isFloating = variant === "hero";
  return (
    <form
      onSubmit={handleSubmit}
      data-testid="search-bar"
      className={
        isFloating
          ? "bg-white border border-[#E5E5E5] p-4 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 rounded-sm"
          : "bg-white border border-[#E5E5E5] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 rounded-sm"
      }
    >
      <div className="md:col-span-4">
        <div className="ds-label mb-1.5 flex items-center gap-1.5">
          <MapPin size={11} /> Standort
        </div>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="h-11 border-[#D4D4D4] rounded-sm" data-testid="search-location">
            <SelectValue placeholder="Standort wählen" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-3">
        <div className="ds-label mb-1.5 flex items-center gap-1.5">
          <Calendar size={11} /> Abholung
        </div>
        <input
          type="date" value={start} min={todayPlus(0)}
          onChange={(e) => setStart(e.target.value)} required
          className="w-full h-11 px-3 border border-[#D4D4D4] rounded-sm font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#E11226]/30 focus:border-[#E11226]"
          data-testid="search-start"
        />
      </div>
      <div className="md:col-span-3">
        <div className="ds-label mb-1.5 flex items-center gap-1.5">
          <Calendar size={11} /> Rückgabe
        </div>
        <input
          type="date" value={end} min={start}
          onChange={(e) => setEnd(e.target.value)} required
          className="w-full h-11 px-3 border border-[#D4D4D4] rounded-sm font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#E11226]/30 focus:border-[#E11226]"
          data-testid="search-end"
        />
      </div>
      <div className="md:col-span-2 flex items-end">
        <Button type="submit" className="w-full h-11 bg-[#E11226] hover:bg-[#C20E1F] rounded-sm uppercase tracking-wider font-semibold text-sm" data-testid="search-submit-btn">
          <Search size={16} className="mr-2" /> Suchen
        </Button>
      </div>
    </form>
  );
}
