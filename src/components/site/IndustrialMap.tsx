import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useMapSites } from "@/lib/data";
import "leaflet/dist/leaflet.css";
import {
  CORRIDORS,
  LAYER_META,
  SITES,
  type Corridor,
  type LayerGroup,
  type MapSite,
  type SiteKind,
} from "@/data/platform";

type RL = typeof import("react-leaflet");
type L  = typeof import("leaflet");

const ALL_LAYERS: LayerGroup[] = [
  "investment",
  "infrastructure",
  "utilities",
  "risk",
  "labor",
  "corridors",
];

const STATUS_COLOR: Record<string, string> = {
  Operational:         "#34d399",
  "Under Construction":"#fbbf24",
  Planned:             "#94a3b8",
};

/* ── Basemap definitions ────────────────────────────────── */
type BasemapKey = "dark" | "light" | "streets" | "atlas" | "satellite" | "topo";
interface BasemapDef {
  label: string;
  tiles: string;
  labels?: string;
  subdomains?: string[];
  isDark: boolean;
  swatch: string;
  mapbox?: boolean; // requires VITE_MAPBOX_TOKEN
}

const _mbToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const BASEMAPS: Record<BasemapKey, BasemapDef> = {
  streets: {
    label: "Streets",
    tiles: _mbToken
      ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${_mbToken}`
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: ["a","b","c","d"],
    isDark: false,
    swatch: "#e8e0d4",
    mapbox: true,
  },
  dark: {
    label: "Dark",
    tiles:  "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    labels: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
    subdomains: ["a","b","c","d"],
    isDark: true,
    swatch: "#1a1a2e",
  },
  light: {
    label: "Light",
    tiles:  "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    labels: "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
    subdomains: ["a","b","c","d"],
    isDark: false,
    swatch: "#dde8ef",
  },
  atlas: {
    label: "Atlas",
    tiles:  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    labels: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
    subdomains: ["a","b","c","d"],
    isDark: false,
    swatch: "#b8cfc8",
  },
  satellite: {
    label: "Satellite",
    tiles: _mbToken
      ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${_mbToken}`
      : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labels: _mbToken ? undefined : "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
    subdomains: ["a","b","c","d"],
    isDark: true,
    swatch: "#2a3d1e",
    mapbox: true,
  },
  topo: {
    label: "Topo",
    tiles:  "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: ["a","b","c"],
    isDark: false,
    swatch: "#c8d8b0",
  },
};

/* Theme → default basemap */
function themeBasemap(): BasemapKey {
  try {
    const stored = localStorage.getItem("tgl_basemap") as BasemapKey | null;
    if (stored && BASEMAPS[stored]) return stored;
    const theme = document.documentElement.getAttribute("data-theme") ?? localStorage.getItem("tgl_theme") ?? "dark";
    // Default to Streets (Mapbox) if token available, otherwise dark
    return _mbToken ? "streets" : (theme === "light" ? "light" : "dark");
  } catch { return "dark"; }
}

/* ── Sub-kind chips per layer ───────────────────────────── */
const LAYER_SUBKINDS: Partial<Record<LayerGroup, { label: string; value: SiteKind | "all" }[]>> = {
  investment: [
    { label: "All",       value: "all"      },
    { label: "SEZ",       value: "sez"      },
    { label: "Park",      value: "park"     },
    { label: "Factory",   value: "factory"  },
    { label: "Logistics", value: "logistics"},
  ],
  infrastructure: [
    { label: "All",        value: "all"      },
    { label: "Port",       value: "port"     },
    { label: "Airport",    value: "airport"  },
    { label: "Expressway", value: "logistics"},
  ],
  utilities: [
    { label: "All",         value: "all"        },
    { label: "Substation",  value: "substation" },
  ],
  labor: [
    { label: "All",         value: "all"        },
    { label: "University",  value: "university" },
    { label: "TVET",        value: "tvet"       },
  ],
};

/* ── Google Maps URL parser ─────────────────────────────── */
function parseGoogleMapsUrl(url: string): [number, number] | null {
  let m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  m = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  m = url.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  return null;
}

function parseCoords(text: string): [number, number] | null {
  const m = text.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  return null;
}

async function geocodePlace(query: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=kh&format=json&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { /* ignore */ }
  return null;
}

/* ── FlyController (must be rendered inside MapContainer) ── */
function FlyController({
  useMap,
  target,
}: {
  useMap: RL["useMap"];
  target: { lat: number; lng: number; zoom: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2 });
  }, [target, map]);
  return null;
}

/* ── Props ──────────────────────────────────────────────── */
interface IndustrialMapProps {
  previewMode?: boolean;
}

/* ── Main export ────────────────────────────────────────── */
export function IndustrialMap({ previewMode = false }: IndustrialMapProps) {
  const [mods, setMods] = useState<{ rl: RL; L: L } | null>(null);
  const { t } = useLang();
  const { data: sites = SITES } = useMapSites();
  const [active, setActive] = useState<Set<LayerGroup>>(new Set(ALL_LAYERS));
  const [selected, setSelected] = useState<MapSite | null>(null);
  const [query, setQuery] = useState("");
  const [subKinds, setSubKinds] = useState<Partial<Record<LayerGroup, SiteKind | "all">>>({});
  const [panelOpen, setPanelOpen] = useState(true); // open by default
  const [basemap, setBasemap] = useState<BasemapKey>(themeBasemap);
  const basemapUserPicked = useRef(false);

  /* Sync basemap with theme toggle (unless user manually picked one) */
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (basemapUserPicked.current) return;
      const theme = document.documentElement.getAttribute("data-theme") ?? "dark";
      setBasemap(theme === "light" ? "light" : "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const pickBasemap = (key: BasemapKey) => {
    basemapUserPicked.current = true;
    setBasemap(key);
    try { localStorage.setItem("tgl_basemap", key); } catch { /* */ }
  };

  /* Location search */
  const [locationInput, setLocationInput] = useState("");
  const [pinTarget, setPinTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [pinMarker, setPinMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [locSearching, setLocSearching] = useState(false);
  const [locError, setLocError] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [rl, L] = await Promise.all([import("react-leaflet"), import("leaflet")]);
      if (!cancel) setMods({ rl, L });
    })();
    return () => { cancel = true; };
  }, []);

  const visible = useMemo(() => {
    if (previewMode) return [];
    const q = query.trim().toLowerCase();
    return sites.filter((s) => {
      if (!active.has(s.layer)) return false;
      const subKind = subKinds[s.layer];
      if (subKind && subKind !== "all" && s.kind !== subKind) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.province.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [active, query, subKinds, previewMode]);

  const visibleCorridors = useMemo(
    () => (active.has("corridors") ? CORRIDORS : []),
    [active],
  );

  const toggle = (g: LayerGroup) => {
    setActive((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  const setSubKind = (layer: LayerGroup, kind: SiteKind | "all") => {
    setSubKinds((prev) => ({ ...prev, [layer]: kind }));
  };

  const handleLocationSearch = async () => {
    const raw = locationInput.trim();
    if (!raw) return;
    setLocSearching(true);
    setLocError("");
    let coords: [number, number] | null = null;

    if (raw.includes("maps.google") || raw.includes("goo.gl") || raw.includes("maps.app")) {
      coords = parseGoogleMapsUrl(raw);
      if (!coords) setLocError(t("map.badUrl"));
    } else {
      coords = parseCoords(raw);
      if (!coords) coords = await geocodePlace(raw);
      if (!coords) setLocError(t("map.noResults"));
    }

    if (coords) {
      setPinMarker({ lat: coords[0], lng: coords[1] });
      setPinTarget({ lat: coords[0], lng: coords[1], zoom: 13 });
      setLocError("");
    }
    setLocSearching(false);
  };

  /* ── Preview mode ───────────────────────────────────────── */
  if (previewMode) {
    return (
      <div className="relative w-full h-full" style={{ pointerEvents: "none" }}>
        {mods ? (
          <PreviewMapView mods={mods} />
        ) : (
          <div className="w-full h-full bg-[#0a0a0b]" />
        )}
      </div>
    );
  }

  /* ── Full map ───────────────────────────────────────────── */
  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full bg-black">
      {/* Basemap */}
      <div className="absolute inset-0">
        {mods ? (
          <MapView
            mods={mods}
            sites={visible}
            corridors={visibleCorridors}
            onSelect={setSelected}
            pinMarker={pinMarker}
            pinTarget={pinTarget}
            basemap={BASEMAPS[basemap]}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-white/40 font-mono text-xs uppercase tracking-widest">
            Loading Cambodia industrial basemap…
          </div>
        )}
      </div>

      {/* ── Search bar (top-center) ────────────────────────── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[600] w-[min(420px,calc(100vw-340px))]">
        <form
          onSubmit={(e) => { e.preventDefault(); handleLocationSearch(); }}
          className="flex items-center bg-black/90 backdrop-blur border border-white/15 overflow-hidden shadow-xl"
        >
          <svg className="ml-3 shrink-0 text-white/30" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            value={locationInput}
            onChange={(e) => { setLocationInput(e.target.value); setLocError(""); }}
            placeholder={t("map.searchPlaceholder")}
            className="flex-1 px-3 py-2.5 text-[11px] text-white bg-transparent placeholder:text-white/25 focus:outline-none font-mono"
          />
          {locationInput && (
            <button type="button" onClick={() => { setLocationInput(""); setPinMarker(null); setLocError(""); }}
              className="text-white/30 hover:text-white px-2 text-base leading-none">✕</button>
          )}
          <button type="submit" disabled={locSearching}
            className="px-3 py-2.5 text-[10px] font-mono uppercase tracking-widest bg-[#ff5100] text-black hover:brightness-110 transition-all disabled:opacity-50 shrink-0 border-l border-white/10">
            {locSearching ? "…" : t("map.go")}
          </button>
        </form>
        {locError && (
          <p className="mt-1 text-[10px] font-mono text-red-400 text-center bg-black/80 px-3 py-1">{locError}</p>
        )}
        {pinMarker && (
          <p className="mt-1 text-[10px] font-mono text-center bg-black/80 px-3 py-1" style={{ color: "#ff5100" }}>
            ★ {pinMarker.lat.toFixed(5)}, {pinMarker.lng.toFixed(5)}
          </p>
        )}
      </div>

      {/* ── Layer panel (left side, open by default) ──────── */}
      <div className="absolute top-4 left-4 z-[500] flex flex-col gap-2">
        {/* Toggle button */}
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 bg-black/90 backdrop-blur border border-white/15 text-white hover:border-white/35 transition-all shadow-lg"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-widest">{t("map.layersBtn")}</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
            {active.size}
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-white/30 transition-transform"
            style={{ transform: panelOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Panel */}
        {panelOpen && (
          <div className="w-72 bg-black/95 backdrop-blur border border-white/10 text-white shadow-2xl"
            style={{ maxHeight: "calc(100vh - 7rem)", overflowY: "auto" }}>
            <div className="px-4 py-3 border-b border-white/10">
              <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>
                Cambodia Industrial Map
              </p>
              <p className="font-extrabold text-sm uppercase tracking-tight mt-0.5">{t("map.layerControl")}</p>
            </div>

            {/* Search */}
            <div className="border-b border-white/10">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("map.searchSite")}
                className="w-full px-4 py-2.5 bg-transparent text-xs placeholder:text-white/30 focus:outline-none"
              />
            </div>

            {/* Layers with sub-kind chips */}
            {ALL_LAYERS.map((g, i) => {
              const meta    = LAYER_META[g];
              const on      = active.has(g);
              const count   = g === "corridors" ? CORRIDORS.length : sites.filter((s) => s.layer === g).length;
              const subDefs = LAYER_SUBKINDS[g];
              const curSub  = subKinds[g] ?? "all";
              return (
                <div key={g} className={`${i < ALL_LAYERS.length - 1 ? "border-b border-white/5" : ""}`}>
                  <button
                    onClick={() => toggle(g)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition"
                  >
                    <span className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color, opacity: on ? 1 : 0.25,
                        boxShadow: on ? `0 0 8px ${meta.color}` : "none" }} />
                    <span className="flex-1">
                      <span className="block text-xs font-bold uppercase tracking-wide">{meta.label}</span>
                      <span className="block text-[10px] text-white/40 mt-0.5">{meta.description}</span>
                    </span>
                    <span className="font-mono text-[10px] text-white/40">{count}</span>
                    {/* Toggle */}
                    <span className={`w-7 h-4 rounded-full relative transition ${on ? "bg-[#ff5100]" : "bg-white/15"}`}>
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`} />
                    </span>
                  </button>

                  {/* Sub-kind chips */}
                  {subDefs && on && (
                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                      {subDefs.map((k) => (
                        <button
                          key={k.value}
                          onClick={() => setSubKind(g, k.value)}
                          className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest border transition-all"
                          style={{
                            backgroundColor: curSub === k.value ? `${meta.color}22` : "transparent",
                            borderColor:     curSub === k.value ? meta.color          : "var(--map-subchip-border)",
                            color:           curSub === k.value ? meta.color          : "var(--map-subchip-text)",
                          }}
                        >
                          {k.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Basemap picker */}
            <div className="border-t border-white/10 px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-2">Base Map</p>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.entries(BASEMAPS) as [BasemapKey, BasemapDef][]).map(([key, bm]) => {
                  const active = basemap === key;
                  return (
                    <button
                      key={key}
                      onClick={() => pickBasemap(key)}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <span
                        className="w-full aspect-square border-2 transition-all"
                        style={{
                          backgroundColor: bm.swatch,
                          borderColor: active ? "#ff5100" : "transparent",
                          boxShadow: active ? "0 0 0 1px #ff5100" : "none",
                        }}
                      />
                      <span
                        className="font-mono text-[8px] uppercase tracking-wider leading-none"
                        style={{ color: active ? "#ff5100" : "rgba(255,255,255,0.35)" }}
                      >
                        {bm.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white/30 border-t border-white/8">
              {visible.length} sites · {visibleCorridors.length} corridors
            </div>
          </div>
        )}
      </div>

      {/* Inspector */}
      {selected && <Inspector site={selected} onClose={() => setSelected(null)} t={t} />}
    </div>
  );
}

/* ── Preview map (homepage background) ─────────────────── */
function PreviewMapView({ mods }: { mods: { rl: RL; L: L } }) {
  const { MapContainer, TileLayer, Polyline } = mods.rl;
  const bm = BASEMAPS[themeBasemap()];
  return (
    <MapContainer
      center={[12.5, 104.9]} zoom={7} minZoom={6} maxZoom={8}
      scrollWheelZoom={false} zoomControl={false} dragging={false}
      doubleClickZoom={false} keyboard={false}
      style={{ height: "100%", width: "100%", background: "#0a0a0b" }}
      attributionControl={false}
    >
      <TileLayer
        url={bm.tiles}
        subdomains={bm.subdomains ?? ["a","b","c","d"]}
      />
      {CORRIDORS.map((c) => (
        <Polyline key={c.id} positions={c.waypoints}
          pathOptions={{ color: c.color, weight: 2, opacity: 0.6,
            dashArray: c.id.includes("ring") ? "6 4" : undefined }} />
      ))}
    </MapContainer>
  );
}

/* ── Icon SVG — color-agnostic paths, parent g supplies fill/stroke ── */
const KIND_ICON_SVG: Record<string, string> = {
  sez:
    `<rect x="-5.5" y="-5" width="11" height="10" rx="1.5" fill="none" stroke-width="2"/>` +
    `<line x1="-1.8" y1="-5" x2="-1.8" y2="5" stroke-width="1.5"/>` +
    `<line x1="1.8" y1="-5" x2="1.8" y2="5" stroke-width="1.5"/>`,
  park:
    `<rect x="-5.5" y="-0.5" width="5" height="6" rx="1" stroke="none"/>` +
    `<rect x="-1.5" y="-5.5" width="7" height="6" rx="1" stroke="none"/>`,
  factory:
    `<path d="M-5.5,5.5 L-5.5,-1 L-2,-4.5 L0,-1 L2,-4.5 L5.5,-1 L5.5,5.5 Z" stroke="none"/>` +
    `<rect x="-1.5" y="0.5" width="3" height="5" rx="0.5" fill="rgba(0,0,0,0.28)" stroke="none"/>`,
  logistics:
    `<path d="M-6.5,2 L-6.5,-3.5 L2,-3.5 L2,-6 L6.5,-1 L6.5,2 Z" stroke="none"/>` +
    `<circle cx="-3.5" cy="2" r="2" stroke="none"/>` +
    `<circle cx="3.5" cy="2" r="2" stroke="none"/>`,
  port:
    `<circle cx="0" cy="-4" r="2.2" fill="none" stroke-width="2"/>` +
    `<line x1="0" y1="-1.8" x2="0" y2="5" stroke-width="2"/>` +
    `<line x1="-5" y1="0.5" x2="5" y2="0.5" stroke-width="2"/>` +
    `<path d="M-4.5,5 Q0,3 4.5,5" fill="none" stroke-width="2"/>`,
  airport:
    `<path d="M0,-6.5 L1.8,0 L7,2.5 L7,4.5 L1.8,2.5 L1.2,7 L3.5,8 L3.5,9 L0,8 L-3.5,9 L-3.5,8 L-1.2,7 L-1.8,2.5 L-7,4.5 L-7,2.5 L-1.8,0 Z" stroke="none"/>`,
  substation:
    `<path d="M2.5,-7 L-4,1.5 L1,1.5 L-2.5,7 L5,-1.5 L0,-1.5 L4,-7 Z" stroke="none"/>`,
  university:
    `<path d="M0,-6 L-7.5,0 L0,3.5 L7.5,0 Z" stroke="none"/>` +
    `<path d="M-5,1.5 L-5,6.5 Q0,9 5,6.5 L5,1.5" fill="none" stroke-width="2"/>` +
    `<line x1="7.5" y1="0" x2="7.5" y2="6" stroke-width="2"/>`,
  tvet:
    `<path d="M-1.5,-7 C-5,-7 -7,-4.5 -6,-2 L4.5,6.5 C5.5,8 8,7.5 7.5,5.5 L-2,-3 C-0.5,-5.5 0.5,-7 -1.5,-7 Z" stroke="none"/>`,
  corridor:
    `<line x1="-6.5" y1="-3" x2="6.5" y2="-3" stroke-width="2.5"/>` +
    `<line x1="-6.5" y1="3" x2="6.5" y2="3" stroke-width="2.5"/>` +
    `<line x1="-2.5" y1="0" x2="2.5" y2="0" stroke-width="1.5" stroke-dasharray="2,2"/>`,
};

/* ── KIND_SVG (Inspector placeholder only — currentColor on dark bg) ─── */
const KIND_SVG: Record<string, string> = {
  sez:        `<path d="M3 19V9l9-6 9 6v10H3z M8 19v-5h3v5 M13 19v-5h3v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`,
  park:       `<rect x="2" y="7" width="7" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="11" y="3" width="11" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
  factory:    `<path d="M2 20V12l5-4v4l5-4v4l5-4v12H2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`,
  logistics:  `<rect x="1" y="9" width="14" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M15 12h4l3 4v1h-7V12z" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="5" cy="18" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="18" cy="18" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
  port:       `<path d="M12 3v14M8 7h8M7 17c1 2 2.5 3 5 3s4-1 5-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>`,
  airport:    `<path d="M12 2l-4 8H2l4 3-2 6 8-2 8 2-2-6 4-3h-6L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`,
  substation: `<path d="M14 2L7 13h6l-2 9 9-12h-6l3-8z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`,
  university: `<path d="M12 3L2 9l10 6 10-6L12 3z M6 12v5c0 2 2.7 3.5 6 3.5s6-1.5 6-3.5v-5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`,
  tvet:       `<path d="M15 4l5 5-9 9-5-2-2-5 9-9z M19 8l-3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`,
  corridor:   `<path d="M4 12h16M9 7l-5 5 5 5M15 7l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
};

/* ── Distinct color per site kind ──────────────────────── */
const KIND_COLOR: Record<string, string> = {
  sez:        "#f97316", // orange
  park:       "#fb923c", // amber-orange
  factory:    "#ef4444", // red
  logistics:  "#eab308", // yellow
  port:       "#2563eb", // deep blue
  airport:    "#0ea5e9", // sky blue
  substation: "#a855f7", // purple
  university: "#10b981", // emerald
  tvet:       "#14b8a6", // teal
  corridor:   "#64748b", // slate
};

/* ── Flat icon marker — no pin, just the category symbol ── */
function makeSiteIcon(L: L, kind: string, color: string, isKey: boolean) {
  const sz   = isKey ? 30 : 24;
  const icon = KIND_ICON_SVG[kind] ?? KIND_ICON_SVG.factory;

  // viewBox -10 -10 20 20: icons fit within ±9 units, centered on coordinate
  const html = `<svg xmlns="http://www.w3.org/2000/svg"
      width="${sz}" height="${sz}" viewBox="-10 -10 20 20"
      style="overflow:visible;filter:drop-shadow(0 1px 4px rgba(0,0,0,0.75)) drop-shadow(0 0 2px rgba(0,0,0,0.5))">
    <g fill="${color}" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
      ${icon}
    </g>
  </svg>`;

  return L.divIcon({
    className:     "",
    html,
    iconSize:      [sz, sz],
    iconAnchor:    [sz / 2, sz / 2],
    tooltipAnchor: [0, -(sz / 2 + 4)],
  });
}

/* ── Full interactive MapView ───────────────────────────── */
function MapView({
  mods, sites, corridors, onSelect, pinMarker, pinTarget, basemap,
}: {
  mods: { rl: RL; L: L };
  sites: MapSite[];
  corridors: Corridor[];
  onSelect: (s: MapSite) => void;
  pinMarker: { lat: number; lng: number } | null;
  pinTarget: { lat: number; lng: number; zoom: number } | null;
  basemap: BasemapDef;
}) {
  const { MapContainer, TileLayer, Tooltip, Polyline, Marker, useMap } = mods.rl;
  const { L } = mods;

  const pinIcon = useMemo(() => L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="14" r="10" fill="#ff5100" opacity="0.95"/>
      <polygon points="12,22 16,31 20,22" fill="#ff5100" opacity="0.95"/>
      <text x="16" y="19" text-anchor="middle" font-size="13" fill="white">★</text>
    </svg>`,
    iconSize: [32, 32],
    iconAnchor: [16, 31],
  }), [L]);

  // Pre-build all site icons (memoised by id+score)
  const siteIcons = useMemo(() => {
    const m = new Map<string, ReturnType<typeof L.divIcon>>();
    sites.forEach((s) => {
      const color = KIND_COLOR[s.kind] ?? LAYER_META[s.layer].color;
      const isKey = s.score !== undefined && s.score >= 85;
      m.set(s.id, makeSiteIcon(L, s.kind, color, isKey));
    });
    return m;
  }, [sites, L]);

  return (
    <MapContainer
      center={[12.2, 104.9]} zoom={7} minZoom={6} maxZoom={17}
      scrollWheelZoom zoomControl={false}
      style={{ height: "100%", width: "100%", background: "#0a0a0b" }}
      attributionControl={false}
    >
      <TileLayer key={basemap.tiles} url={basemap.tiles}
        subdomains={basemap.subdomains ?? ["a","b","c","d"]}
        tileSize={basemap.mapbox ? 256 : 256}
        zoomOffset={0}
        maxZoom={18}
      />
      {basemap.labels && (
        <TileLayer key={basemap.labels} url={basemap.labels}
          subdomains={["a","b","c","d"]} />
      )}

      <FlyController useMap={useMap} target={pinTarget} />

      {corridors.map((c) => (
        <Polyline key={c.id} positions={c.waypoints}
          pathOptions={{ color: c.color, weight: 3, opacity: 0.75,
            dashArray: c.id.includes("ring") ? "6 4" : undefined }}>
          <Tooltip sticky direction="top" opacity={0.92}>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: c.color }}>{c.shortName}</span>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fff", marginLeft: 6 }}>
              {c.name.split("—")[1]?.trim()}
            </span>
          </Tooltip>
        </Polyline>
      ))}

      {sites.map((s) => {
        const color = KIND_COLOR[s.kind] ?? LAYER_META[s.layer].color;
        const icon = siteIcons.get(s.id);
        if (!icon) return null;
        return (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={icon}
            eventHandlers={{ click: () => onSelect(s) }}>
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
              <span style={{ fontFamily: "monospace", fontSize: 10, color }}>{s.kind.toUpperCase()}</span>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fff", marginLeft: 6 }}>{s.name}</span>
            </Tooltip>
          </Marker>
        );
      })}

      {pinMarker && pinIcon && (
        <Marker position={[pinMarker.lat, pinMarker.lng]} icon={pinIcon}>
          <Tooltip permanent direction="top" offset={[0, -16]} opacity={0.95}>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#ff5100" }}>★ YOUR LOCATION</span>
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}

/* ── Inspector ──────────────────────────────────────────── */
function Inspector({ site, onClose, t }: { site: MapSite; onClose: () => void; t: (key: string) => string }) {
  const layerColor = LAYER_META[site.layer].color;
  const scoreColor = site.score !== undefined
    ? site.score >= 85 ? "#34d399" : site.score >= 70 ? "#fbbf24" : "#f43f5e"
    : "#94a3b8";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${site.lat},${site.lng}`;
  const kindSvg = KIND_SVG[site.kind] ?? KIND_SVG.factory;

  return (
    <aside className="absolute top-4 right-4 z-[400] w-[340px] max-w-[calc(100vw-2rem)] bg-[#0d0d0e] backdrop-blur border border-white/12 text-white flex flex-col max-h-[calc(100vh-5rem)] overflow-hidden shadow-2xl">

      {/* ── Visual header: news photo OR styled placeholder ── */}
      {site.image_url ? (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="relative shrink-0 block overflow-hidden group">
          <img
            src={site.image_url}
            alt={site.name}
            className="w-full h-[140px] object-cover object-center"
            style={{ filter: "brightness(0.82) contrast(1.08)" }}
            onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0e] via-[#0d0d0e10] to-transparent" />
          <div className="absolute bottom-2 right-3 opacity-0 group-hover:opacity-100 transition">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/80">Open in Maps ↗</span>
          </div>
          <div className="absolute top-2 left-3">
            <span className="px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider bg-black/60 text-white/70 backdrop-blur-sm">
              {site.province}
            </span>
          </div>
        </a>
      ) : (
        /* Styled placeholder — kind icon + gradient, no map thumbnail */
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="relative shrink-0 flex items-center justify-center h-[90px] overflow-hidden group border-b border-white/8"
          style={{ background: `linear-gradient(135deg, ${layerColor}22 0%, #0d0d0e 75%)` }}>
          <div dangerouslySetInnerHTML={{ __html:
            `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" style="opacity:0.25">
              <g fill="none" stroke="${layerColor}" stroke-width="1">${kindSvg}</g>
            </svg>`
          }} />
          <div className="absolute top-2 left-3">
            <span className="px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider bg-black/40 text-white/50 backdrop-blur-sm">
              {site.province}
            </span>
          </div>
          <div className="absolute bottom-2 right-3 opacity-0 group-hover:opacity-100 transition">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/50">Open in Maps ↗</span>
          </div>
        </a>
      )}

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-white/10">
        {/* Layer / kind strip */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: layerColor, boxShadow: `0 0 6px ${layerColor}` }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">
              {LAYER_META[site.layer].label}
            </span>
            <span className="font-mono text-[9px] text-white/25">·</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: layerColor }}>
              {site.kind}
            </span>
          </div>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition rounded-sm">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M1 1l8 8M9 1L1 9"/>
            </svg>
          </button>
        </div>

        {/* Name + status */}
        <div className="px-4 pb-3">
          <h3 className="font-extrabold text-[15px] uppercase tracking-tight leading-tight text-white">{site.name}</h3>
          {site.status && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLOR[site.status] ?? "#94a3b8" }} />
              <span className="font-mono text-[10px]" style={{ color: STATUS_COLOR[site.status] ?? "#94a3b8" }}>{site.status}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="overflow-y-auto flex-1">

        {/* Notes — always shown first if present */}
        {site.notes && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-[12px] text-white/75 leading-relaxed">{site.notes}</p>
          </div>
        )}

        {/* Key facts grid */}
        {(site.size || site.utilities || site.road) && (
          <div className="border-b border-white/8">
            <p className="px-4 pt-3 pb-1.5 font-mono text-[9px] uppercase tracking-widest text-white/35">Details</p>
            <dl className="px-4 pb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[11px]">
              {site.size      && <Row k="Size"       v={site.size}      />}
              {site.utilities && <Row k="Utilities"  v={site.utilities} />}
              {site.road      && <Row k="Road Access" v={site.road}     />}
            </dl>
          </div>
        )}

        {/* Suitability score */}
        {site.score !== undefined && (
          <div className="px-4 py-3 border-b border-white/8">
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/35">Suitability Score</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold leading-none" style={{ color: scoreColor }}>{site.score}</span>
                <span className="font-mono text-[9px] text-white/30">/100</span>
              </div>
            </div>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${site.score}%`, backgroundColor: scoreColor }} />
            </div>
          </div>
        )}

        {/* Target industries */}
        {!!site.targetIndustries?.length && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-2">Relevant Sectors</p>
            <div className="flex flex-wrap gap-1.5">
              {site.targetIndustries.map((ind) => (
                <span key={ind}
                  className="px-2 py-1 font-mono text-[9px] uppercase tracking-wider border"
                  style={{ backgroundColor: `${layerColor}12`, borderColor: `${layerColor}35`, color: layerColor }}>
                  {ind}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Strengths */}
        {!!site.strengths?.length && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-2">Strengths</p>
            <ul className="space-y-1.5">
              {site.strengths.map((s) => (
                <li key={s} className="flex items-start gap-2 text-[11px] text-white/80 leading-snug">
                  <span className="text-[#34d399] font-bold shrink-0 mt-0.5 text-[10px]">✓</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Constraints */}
        {!!site.constraints?.length && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-2">Constraints</p>
            <ul className="space-y-1.5">
              {site.constraints.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[11px] text-white/80 leading-snug">
                  <span className="text-[#f43f5e] font-bold shrink-0 mt-0.5 text-[10px]">!</span>{c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* GentryLab advisory recommendation */}
        {site.recommendation && (
          <div className="px-4 py-3 border-b border-white/8 bg-[#ff510008]">
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: "#ff5100" }}>
              ◈ GentryLab Advisory
            </p>
            <p className="text-[11.5px] text-white/85 leading-relaxed">{site.recommendation}</p>
          </div>
        )}

        {/* Location + Google Maps */}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 border-b border-white/8 hover:bg-white/5 transition group">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" className="text-white/30 group-hover:text-[#ff5100] shrink-0 transition">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 group-hover:text-white/50 transition">
              Coordinates · Open in Maps ↗
            </p>
            <p className="font-mono text-[10px] text-white/55 mt-0.5">
              {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
            </p>
          </div>
        </a>

        {/* Footer disclaimer */}
        <div className="px-4 py-2.5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/20">
            {t("map.disclaimer")}
          </p>
        </div>
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="font-mono text-[9px] uppercase tracking-widest text-white/35 pt-0.5">{k}</dt>
      <dd className="text-white/85 text-[11px] leading-snug">{v}</dd>
    </>
  );
}
