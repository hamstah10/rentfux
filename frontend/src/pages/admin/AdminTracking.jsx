import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Navigation, Gauge, Search, AlertTriangle, MapPin, RefreshCw,
  Car as CarIcon, Pause, Activity, Route as RouteIcon, X,
} from "lucide-react";
import { toast } from "sonner";

const ANCHOR = [53.5396, 8.5809];
const FENCE_RADIUS_M = 50 * 1000; // 50 km in meters
const REFRESH_MS = 12000;

const STATUS_COLOR = {
  parked: "#737373",
  city: "#0891B2",
  highway: "#E11226",
};
const STATUS_LABEL = {
  parked: "Parkend",
  city: "Stadt",
  highway: "Schnellstraße",
};

function makePin(color, rotation = 0, isActive = false) {
  const ring = isActive ? `<circle cx="14" cy="14" r="13" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1"/>` : "";
  return L.divIcon({
    className: "rf-gps-pin",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">
        ${ring}
        <g transform="rotate(${rotation} 14 14)">
          <path d="M14 4 L19 22 L14 18 L9 22 Z" fill="${color}" stroke="#0A0A0A" stroke-width="1" stroke-linejoin="round" />
        </g>
      </svg>
    `,
  });
}

function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, Math.max(map.getZoom(), 14), { duration: 0.6 });
    }
  }, [position, map]);
  return null;
}

export default function AdminTracking() {
  const { vehicleId: selectedFromUrl } = useParams();
  const navigate = useNavigate();
  const [fleet, setFleet] = useState([]);
  const [selectedId, setSelectedId] = useState(selectedFromUrl || null);
  const [track, setTrack] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all|parked|city|highway|alert
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const pollRef = useRef(null);

  const selected = useMemo(
    () => fleet.find((v) => v.vehicle_id === selectedId) || null,
    [fleet, selectedId]
  );

  const filtered = useMemo(() => {
    let list = fleet;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.brand.toLowerCase().includes(q) ||
          (v.category || "").toLowerCase().includes(q)
      );
    }
    if (filter === "alert") list = list.filter((v) => v.geofence_alert);
    else if (filter !== "all") list = list.filter((v) => v.status === filter);
    return list;
  }, [fleet, query, filter]);

  const stats = useMemo(() => {
    const c = { total: fleet.length, parked: 0, city: 0, highway: 0, alerts: 0 };
    fleet.forEach((v) => {
      if (v.status === "parked") c.parked++;
      else if (v.status === "city") c.city++;
      else if (v.status === "highway") c.highway++;
      if (v.geofence_alert) c.alerts++;
    });
    return c;
  }, [fleet]);

  const loadFleet = async () => {
    try {
      const { data } = await api.get("/admin/fleet/locations");
      setFleet(data);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const loadTrack = async (vid) => {
    if (!vid) return;
    try {
      const { data } = await api.get(`/admin/vehicles/${vid}/track?limit=40`);
      setTrack(data);
    } catch {
      setTrack([]);
    }
  };

  useEffect(() => {
    loadFleet();
  }, []);

  // Polling
  useEffect(() => {
    if (paused) return;
    pollRef.current = setInterval(() => {
      loadFleet();
      if (selectedId) loadTrack(selectedId);
    }, REFRESH_MS);
    return () => clearInterval(pollRef.current);
  }, [paused, selectedId]);

  // On selection change, fetch track
  useEffect(() => {
    if (selectedId) loadTrack(selectedId);
    else setTrack([]);
  }, [selectedId]);

  const selectVehicle = (vid) => {
    setSelectedId(vid);
    navigate(vid ? `/admin/tracking/${vid}` : "/admin/tracking", { replace: true });
  };

  const trackLine = track
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number")
    .map((p) => [p.lat, p.lng]);

  return (
    <div className="rf-fade-in" data-testid="admin-tracking">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-[#E11226] font-semibold">Flotte · Live</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[#0A0A0A] mt-1">GPS-Tracking</h1>
          <p className="text-sm text-[#525252] mt-1">
            Aktuelle Positionen aller Fahrzeuge. Mock-Daten – aktualisiert sich alle 12 Sekunden.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            data-testid="tracking-pause"
            title={paused ? "Live-Updates fortsetzen" : "Live-Updates pausieren"}
          >
            {paused ? <Activity size={14} className="mr-1.5" /> : <Pause size={14} className="mr-1.5" />}
            {paused ? "Fortsetzen" : "Pausieren"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { loadFleet(); if (selectedId) loadTrack(selectedId); }}
            data-testid="tracking-refresh"
          >
            <RefreshCw size={14} className="mr-1.5" /> Aktualisieren
          </Button>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Verfolgt" value={stats.total} icon={CarIcon} testid="stat-total" />
        <Stat label="Parkend" value={stats.parked} icon={Pause} color="#737373" testid="stat-parked" />
        <Stat label="Stadt" value={stats.city} icon={Gauge} color="#0891B2" testid="stat-city" />
        <Stat label="Schnellstraße" value={stats.highway} icon={Navigation} color="#E11226" testid="stat-highway" />
        <Stat label="Warnungen" value={stats.alerts} icon={AlertTriangle} color="#D97706" testid="stat-alerts" alert />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sidebar list */}
        <aside className="lg:col-span-4 xl:col-span-3 bg-white border border-[#E5E5E5] rounded-sm overflow-hidden flex flex-col" style={{ maxHeight: "680px" }}>
          <div className="p-3 border-b border-[#E5E5E5] space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
              <Input
                placeholder="Suche Marke, Modell, Kategorie…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 pl-9 text-sm"
                data-testid="tracking-search"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                ["all", "Alle"],
                ["parked", "Parkend"],
                ["city", "Stadt"],
                ["highway", "Highway"],
                ["alert", "Alerts"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-sm uppercase tracking-wider border transition ${
                    filter === k
                      ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                      : "bg-white text-[#525252] border-[#E5E5E5] hover:border-[#A3A3A3]"
                  }`}
                  data-testid={`tracking-filter-${k}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#E5E5E5]" data-testid="tracking-list">
            {loading ? (
              <div className="p-6 text-sm text-[#525252]">Lädt Flotte…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-[#525252] text-center">Keine Fahrzeuge entsprechen dem Filter.</div>
            ) : (
              filtered.map((v) => {
                const isActive = v.vehicle_id === selectedId;
                return (
                  <button
                    key={v.vehicle_id}
                    onClick={() => selectVehicle(v.vehicle_id)}
                    className={`w-full text-left px-3 py-3 hover:bg-[#FAFAFA] transition flex items-center gap-3 ${
                      isActive ? "bg-[#FEE2E5]" : ""
                    }`}
                    data-testid={`tracking-vehicle-${v.vehicle_id}`}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: STATUS_COLOR[v.status] || "#A3A3A3" }}
                    />
                    <img
                      src={v.image_url}
                      alt=""
                      className="w-12 h-10 object-cover rounded-sm border border-[#E5E5E5] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-wider text-[#A3A3A3] truncate">{v.brand}</div>
                      <div className="font-semibold text-[#0A0A0A] truncate text-sm">{v.name}</div>
                      <div className="text-[11px] text-[#525252] flex items-center gap-2 mt-0.5 rf-readout">
                        <span>{Math.round(v.speed_kmh)} km/h</span>
                        <span>·</span>
                        <span>{STATUS_LABEL[v.status] || v.status}</span>
                      </div>
                    </div>
                    {v.geofence_alert && (
                      <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Map + detail */}
        <section className="lg:col-span-8 xl:col-span-9">
          <div className="relative bg-white border border-[#E5E5E5] rounded-sm overflow-hidden" style={{ height: "560px" }}>
            <MapContainer
              center={ANCHOR}
              zoom={11}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Circle
                center={ANCHOR}
                radius={FENCE_RADIUS_M}
                pathOptions={{ color: "#A3A3A3", weight: 1, dashArray: "4 6", fillOpacity: 0.02 }}
              />
              {selected && <FlyTo position={[selected.lat, selected.lng]} />}
              {fleet.map((v) => (
                <Marker
                  key={v.vehicle_id}
                  position={[v.lat, v.lng]}
                  icon={makePin(STATUS_COLOR[v.status] || "#737373", v.heading || 0, v.vehicle_id === selectedId)}
                  eventHandlers={{ click: () => selectVehicle(v.vehicle_id) }}
                >
                  <Popup>
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-[#0A0A0A]">{v.brand} {v.name}</div>
                      <div className="text-[#525252]">{STATUS_LABEL[v.status]} · {Math.round(v.speed_kmh)} km/h</div>
                      <div className="text-[10px] text-[#A3A3A3]">{new Date(v.ts).toLocaleString("de-DE")}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {trackLine.length > 1 && (
                <Polyline positions={trackLine} pathOptions={{ color: "#E11226", weight: 3, opacity: 0.85 }} />
              )}
            </MapContainer>

            {/* live indicator */}
            <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur border border-[#E5E5E5] rounded-sm px-3 py-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A]">
              <span className={`w-2 h-2 rounded-full ${paused ? "bg-[#A3A3A3]" : "bg-[#16A34A] animate-pulse"}`} />
              {paused ? "Pausiert" : "Live"}
            </div>
          </div>

          {/* Selected detail */}
          {selected && (
            <div className="mt-4 bg-white border border-[#E5E5E5] rounded-sm p-5" data-testid="tracking-detail">
              <div className="flex items-start gap-4 flex-wrap">
                <img src={selected.image_url} alt="" className="w-28 h-20 object-cover rounded-sm border border-[#E5E5E5]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-xs uppercase tracking-wider text-[#A3A3A3]">{selected.brand}</div>
                    <Badge className="bg-[#F4F4F4] text-[#262626] border-0">{selected.category}</Badge>
                    {selected.geofence_alert && (
                      <Badge className="bg-amber-100 text-amber-800 border-0 gap-1.5">
                        <AlertTriangle size={11} /> Geofence-Warnung
                      </Badge>
                    )}
                  </div>
                  <div className="font-display font-bold text-xl text-[#0A0A0A] mt-0.5">{selected.name}</div>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <DetailKV label="Status" value={STATUS_LABEL[selected.status] || selected.status}
                      color={STATUS_COLOR[selected.status]} icon={Activity} />
                    <DetailKV label="Geschwindigkeit" value={`${Math.round(selected.speed_kmh)} km/h`} icon={Gauge} />
                    <DetailKV label="Distanz vom Standort" value={`${selected.fence_km.toFixed(1)} km`} icon={MapPin} />
                    <DetailKV label="Letztes Signal" value={new Date(selected.ts).toLocaleTimeString("de-DE")} icon={RouteIcon} />
                  </div>
                  <div className="mt-3 text-[11px] text-[#737373] rf-readout">
                    {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)} · Kurs {Math.round(selected.heading)}° · Quelle: {selected.source}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectVehicle(null)}
                  data-testid="tracking-clear"
                >
                  <X size={14} className="mr-1" /> Auswahl aufheben
                </Button>
              </div>

              {track.length > 1 && (
                <div className="mt-5 pt-4 border-t border-[#E5E5E5]">
                  <div className="text-[11px] uppercase tracking-wider text-[#525252] mb-1.5 flex items-center gap-1.5">
                    <RouteIcon size={12} /> Letzte {track.length} Positionen
                  </div>
                  <div className="text-xs text-[#737373]">
                    Die rote Linie auf der Karte zeigt den zurückgelegten Track.
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color = "#0A0A0A", testid, alert }) {
  return (
    <div
      className={`bg-white border rounded-sm p-3 flex items-center gap-3 ${
        alert && value > 0 ? "border-amber-300 bg-amber-50/50" : "border-[#E5E5E5]"
      }`}
      data-testid={testid}
    >
      <div
        className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0"
        style={{ background: `${color}15`, color }}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-[#525252]">{label}</div>
        <div className="font-display font-bold text-xl text-[#0A0A0A] rf-readout">{value}</div>
      </div>
    </div>
  );
}

function DetailKV({ label, value, icon: Icon, color }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[#A3A3A3] flex items-center gap-1">
        <Icon size={11} /> {label}
      </div>
      <div className="font-semibold text-[#0A0A0A] mt-0.5" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
