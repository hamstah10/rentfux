import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "@/components/SearchBar";
import VehicleCard from "@/components/VehicleCard";
import { api } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Filter, SlidersHorizontal } from "lucide-react";

const CATEGORIES = ["Kleinwagen", "Kompakt", "Mittelklasse", "SUV", "Van", "Luxus", "Transporter"];
const TRANSMISSIONS = ["Automatik", "Schaltgetriebe"];
const FUELS = ["Benzin", "Diesel", "Elektro", "Hybrid"];

export default function Catalog() {
  const [params] = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState([]);
  const [transmissions, setTransmissions] = useState([]);
  const [fuels, setFuels] = useState([]);
  const [priceRange, setPriceRange] = useState([20, 200]);
  const [seatsMin, setSeatsMin] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get("/vehicles").then((r) => setVehicles(r.data)).finally(() => setLoading(false));
  }, []);

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (categories.length && !categories.includes(v.category)) return false;
      if (transmissions.length && !transmissions.includes(v.transmission)) return false;
      if (fuels.length && !fuels.includes(v.fuel)) return false;
      if (v.price_per_day < priceRange[0] || v.price_per_day > priceRange[1]) return false;
      if (seatsMin && v.seats < seatsMin) return false;
      return true;
    });
  }, [vehicles, categories, transmissions, fuels, priceRange, seatsMin]);

  return (
    <div className="rf-fade-in" data-testid="catalog-page">
      <div className="bg-[#F8FAFC] border-b border-[#E5E5E5]">
        <div className="rf-container py-10">
          <div className="mb-2 text-xs tracking-[0.2em] uppercase text-[#E11226] font-semibold">Fahrzeuge</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[#0A0A0A] mb-6">Unsere Flotte</h1>
          <SearchBar variant="inline" />
        </div>
      </div>

      <div className="rf-container py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Filters */}
        <aside className="lg:col-span-3">
          <div className="sticky top-24 bg-white border border-[#E5E5E5] rounded-lg p-5">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#E5E5E5]">
              <SlidersHorizontal size={16} className="text-[#E11226]" />
              <h3 className="font-display font-semibold text-lg text-[#0A0A0A]">Filter</h3>
            </div>

            <div className="mb-6">
              <Label className="text-xs uppercase tracking-wider text-[#525252] mb-3 block">Preis pro Tag</Label>
              <Slider
                value={priceRange} min={0} max={300} step={5}
                onValueChange={setPriceRange}
                data-testid="filter-price"
              />
              <div className="flex justify-between text-sm text-[#525252] mt-2">
                <span>{priceRange[0]}€</span>
                <span>{priceRange[1]}€</span>
              </div>
            </div>

            <FilterGroup title="Kategorie" items={CATEGORIES} selected={categories}
              onChange={(v) => toggle(categories, setCategories, v)} testid="cat" />
            <FilterGroup title="Getriebe" items={TRANSMISSIONS} selected={transmissions}
              onChange={(v) => toggle(transmissions, setTransmissions, v)} testid="trans" />
            <FilterGroup title="Kraftstoff" items={FUELS} selected={fuels}
              onChange={(v) => toggle(fuels, setFuels, v)} testid="fuel" />

            <div>
              <Label className="text-xs uppercase tracking-wider text-[#525252] mb-3 block">Mind. Sitzplätze</Label>
              <div className="flex gap-2 flex-wrap">
                {[0, 2, 4, 5, 7].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSeatsMin(n)}
                    data-testid={`filter-seats-${n}`}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      seatsMin === n ? "bg-[#E11226] text-white border-[#E11226]" : "bg-white text-[#262626] border-[#D4D4D4] hover:border-[#A3A3A3]"
                    }`}
                  >
                    {n === 0 ? "Alle" : `${n}+`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <section className="lg:col-span-9">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-[#525252]" data-testid="results-count">
              <Filter size={14} className="inline mr-1.5 -mt-0.5" />
              {loading ? "Lädt..." : `${filtered.length} Fahrzeuge gefunden`}
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 bg-[#F4F4F4] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-[#D4D4D4] rounded-lg">
              <div className="text-[#525252]">Keine Fahrzeuge mit diesen Filtern gefunden.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterGroup({ title, items, selected, onChange, testid }) {
  return (
    <div className="mb-6">
      <Label className="text-xs uppercase tracking-wider text-[#525252] mb-3 block">{title}</Label>
      <div className="space-y-2">
        {items.map((item) => (
          <label key={item} className="flex items-center gap-2 cursor-pointer text-sm text-[#262626]">
            <Checkbox
              checked={selected.includes(item)}
              onCheckedChange={() => onChange(item)}
              data-testid={`filter-${testid}-${item}`}
            />
            {item}
          </label>
        ))}
      </div>
    </div>
  );
}
