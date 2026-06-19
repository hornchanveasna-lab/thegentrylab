import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useLang } from "@/lib/i18n";
import { useMapSites } from "@/lib/data";
import {
  CORRIDORS,
  LAYER_META,
  SITES,
  type Corridor,
  type LayerGroup,
  type MapSite,
  type SiteKind,
} from "@/data/platform";

const ALL_LAYERS: LayerGroup[] = [
  "investment", "infrastructure", "energy", "water",
  "environment", "risk", "labor", "corridors",
];

const STATUS_COLOR: Record<string, string> = {
  Operational:          "#34d399",
  "Under Construction": "#fbbf24",
  Planned:              "#94a3b8",
};

/* ── Google Maps style arrays ───────────────────────────── */
const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry",            stylers: [{ color: "#0d1117" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#7a8899" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#0d1117" }] },
  { featureType: "road.highway",         elementType: "geometry",         stylers: [{ color: "#9b2d00" }] },
  { featureType: "road.highway",         elementType: "geometry.stroke",  stylers: [{ color: "#ff5100" }, { weight: 1.5 }] },
  { featureType: "road.highway",         elementType: "labels.text.fill", stylers: [{ color: "#e0c8be" }] },
  { featureType: "road.arterial",        elementType: "geometry",         stylers: [{ color: "#172030" }] },
  { featureType: "road.local",           elementType: "geometry",         stylers: [{ color: "#10171f" }] },
  { featureType: "administrative",       elementType: "geometry.stroke",  stylers: [{ color: "#2a3545" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#445060" }, { weight: 1.5 }] },
  { featureType: "poi",                  stylers: [{ visibility: "off" }] },
  { featureType: "transit",              stylers: [{ visibility: "off" }] },
  { featureType: "water",                elementType: "geometry",         stylers: [{ color: "#0a1628" }] },
  { featureType: "water",                elementType: "labels.text.fill", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "landscape",            elementType: "geometry",         stylers: [{ color: "#0f1a22" }] },
  { featureType: "landscape.natural",    elementType: "geometry",         stylers: [{ color: "#0c1820" }] },
];

const LIGHT_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry",            stylers: [{ color: "#f5f0eb" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#2d3748" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#f5f0eb" }, { weight: 3 }] },
  { featureType: "road.highway",         elementType: "geometry",         stylers: [{ color: "#ff5100" }] },
  { featureType: "road.highway",         elementType: "geometry.stroke",  stylers: [{ color: "#cc4100" }, { weight: 0.6 }] },
  { featureType: "road.highway",         elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial",        elementType: "geometry",         stylers: [{ color: "#ddd8d0" }] },
  { featureType: "road.local",           elementType: "geometry",         stylers: [{ color: "#e8e3dc" }] },
  { featureType: "poi",                  stylers: [{ visibility: "off" }] },
  { featureType: "transit",             stylers: [{ visibility: "off" }] },
  { featureType: "water",               elementType: "geometry",         stylers: [{ color: "#b3d4e8" }] },
  { featureType: "landscape",           elementType: "geometry",         stylers: [{ color: "#f0ece5" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#b0a090" }, { weight: 1.5 }] },
];

/* ── Basemap definitions (Google Maps JS API style) ─────── */
type BasemapKey = "dark" | "light" | "terrain" | "satellite" | "flood";
interface BasemapDef {
  label: string;
  mapTypeId: string;
  styles?: google.maps.MapTypeStyle[];
  isDark: boolean;
  swatch: string;
  floodOverlay?: boolean;
}

const BASEMAPS: Record<BasemapKey, BasemapDef> = {
  dark:      { label: "Dark",      mapTypeId: "roadmap",  styles: DARK_STYLES,  isDark: true,  swatch: "#0d1117" },
  light:     { label: "Light",     mapTypeId: "roadmap",  styles: LIGHT_STYLES, isDark: false, swatch: "#e8e4dc" },
  terrain:   { label: "Terrain",   mapTypeId: "terrain",  isDark: false, swatch: "#c5d5a0" },
  satellite: { label: "Satellite", mapTypeId: "hybrid",   isDark: true,  swatch: "#1a2f1a" },
  flood:     { label: "Flood",     mapTypeId: "hybrid",   isDark: true,  swatch: "#0a1a2f", floodOverlay: true },
};

function themeBasemap(): BasemapKey {
  try {
    const stored = localStorage.getItem("tgl_basemap") as BasemapKey | null;
    if (stored && BASEMAPS[stored]) return stored;
    return "dark";
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
    { label: "All",     value: "all"    },
    { label: "Port",    value: "port"   },
    { label: "Airport", value: "airport"},
    { label: "Rail",    value: "rail"   },
  ],
  energy: [
    { label: "All",         value: "all"        },
    { label: "Substation",  value: "substation" },
    { label: "Power Plant", value: "powerplant" },
    { label: "Solar",       value: "solar"      },
  ],
  water: [
    { label: "All",         value: "all"        },
    { label: "Water Plant", value: "water_plant"},
  ],
  environment: [
    { label: "All",       value: "all"      },
    { label: "Protected", value: "protected"},
    { label: "Waste",     value: "waste"    },
  ],
  labor: [
    { label: "All",        value: "all"       },
    { label: "University", value: "university"},
    { label: "TVET",       value: "tvet"      },
    { label: "Hospital",   value: "hospital"  },
  ],
};

/* ── Location parsers ───────────────────────────────────── */
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
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    const url = key
      ? `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query + " Cambodia")}&key=${key}`
      : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=kh&format=json&limit=1`;
    const res = await fetch(url, key ? {} : { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (key) {
      const loc = data.results?.[0]?.geometry?.location;
      return loc ? [loc.lat, loc.lng] : null;
    }
    if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { /* ignore */ }
  return null;
}

/* ── Tile bounds helper for WMS overlay ─────────────────── */
function tileToBounds(x: number, y: number, z: number) {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  const north = (northRad * 180) / Math.PI;
  const south = (southRad * 180) / Math.PI;
  return { west, east, north, south };
}

/* ── Icon SVG paths ─────────────────────────────────────── */
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
  solar:
    `<circle cx="0" cy="0" r="3.5" stroke="none"/>` +
    `<line x1="0" y1="-7" x2="0" y2="-5" stroke-width="2"/>` +
    `<line x1="0" y1="5" x2="0" y2="7" stroke-width="2"/>` +
    `<line x1="-7" y1="0" x2="-5" y2="0" stroke-width="2"/>` +
    `<line x1="5" y1="0" x2="7" y2="0" stroke-width="2"/>` +
    `<line x1="-4.9" y1="-4.9" x2="-3.5" y2="-3.5" stroke-width="2"/>` +
    `<line x1="3.5" y1="3.5" x2="4.9" y2="4.9" stroke-width="2"/>` +
    `<line x1="4.9" y1="-4.9" x2="3.5" y2="-3.5" stroke-width="2"/>` +
    `<line x1="-3.5" y1="3.5" x2="-4.9" y2="4.9" stroke-width="2"/>`,
  water_plant:
    `<path d="M0,-7 C-3,-3 -6,0 -6,3 a6,6 0 0,0 12,0 C6,0 3,-3 0,-7Z" stroke="none"/>`,
  hospital:
    `<rect x="-6" y="-6" width="12" height="12" rx="1.5" fill="none" stroke-width="2"/>` +
    `<line x1="0" y1="-3.5" x2="0" y2="3.5" stroke-width="2.5"/>` +
    `<line x1="-3.5" y1="0" x2="3.5" y2="0" stroke-width="2.5"/>`,
  waste:
    `<path d="M-5,-4 L-3,-7 L3,-7 L5,-4 L-5,-4Z" stroke="none"/>` +
    `<rect x="-5" y="-4" width="10" height="11" rx="1" fill="none" stroke-width="2"/>` +
    `<line x1="-2" y1="-2" x2="-2" y2="5" stroke-width="1.5"/>` +
    `<line x1="2" y1="-2" x2="2" y2="5" stroke-width="1.5"/>`,
  rail:
    `<line x1="-6" y1="-3.5" x2="6" y2="-3.5" stroke-width="2.5"/>` +
    `<line x1="-6" y1="3.5" x2="6" y2="3.5" stroke-width="2.5"/>` +
    `<line x1="-4" y1="-3.5" x2="-4" y2="3.5" stroke-width="1.5"/>` +
    `<line x1="0" y1="-3.5" x2="0" y2="3.5" stroke-width="1.5"/>` +
    `<line x1="4" y1="-3.5" x2="4" y2="3.5" stroke-width="1.5"/>`,
  protected:
    `<path d="M0,-8 L-7,-4 L-7,2 C-7,6 -3,8 0,9 C3,8 7,6 7,2 L7,-4 Z" fill="none" stroke-width="2"/>`,
};

const KIND_SVG: Record<string, string> = {
  sez:        `<path d="M3 19V9l9-6 9 6v10H3z M8 19v-5h3v5 M13 19v-5h3v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`,
  park:       `<rect x="2" y="7" width="7" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="11" y="3" width="11" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
  factory:    `<path d="M2 20V12l5-4v4l5-4v4l5-4v12H2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`,
  logistics:  `<rect x="1" y="9" width="14" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M15 12h4l3 4v1h-7V12z" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="5" cy="18" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="18" cy="18" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
  port:       `<path d="M12 3v14M8 7h8M7 17c1 2 2.5 3 5 3s4-1 5-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>`,
  airport:    `<path d="M12 2l-4 8H2l4 3-2 6 8-2 8 2-2-6 4-3h-6L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`,
  substation: `<path d="M14 2L7 13h6l-2 9 9-12h-6l3-8z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`,
  powerplant: `<path d="M12 2v4M6.3 4.3l2.8 2.9M4 10H2M4.3 17.7l2.8-2.8M12 22v-4M17.7 17.7l-2.8-2.8M20 10h2M17.7 4.3l-2.8 2.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/><circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
  university: `<path d="M12 3L2 9l10 6 10-6L12 3z M6 12v5c0 2 2.7 3.5 6 3.5s6-1.5 6-3.5v-5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`,
  tvet:       `<path d="M15 4l5 5-9 9-5-2-2-5 9-9z M19 8l-3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`,
  corridor:   `<path d="M4 12h16M9 7l-5 5 5 5M15 7l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  solar:      `<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  water_plant:`<path d="M12 3C9 8 6 10 6 14a6 6 0 0012 0c0-4-3-6-6-11z" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
  hospital:   `<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  waste:      `<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  rail:       `<path d="M4 5h16M4 19h16M8 5v14M16 5v14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  protected:  `<path d="M12 2l-9 4v5c0 5 4 9.5 9 11 5-1.5 9-6 9-11V6L12 2z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`,
};

const KIND_COLOR: Record<string, string> = {
  sez:         "#f97316",
  park:        "#fb923c",
  factory:     "#ef4444",
  logistics:   "#eab308",
  port:        "#2563eb",
  airport:     "#0ea5e9",
  substation:  "#a855f7",
  powerplant:  "#c084fc",
  solar:       "#fbbf24",
  water_plant: "#38bdf8",
  hospital:    "#f472b6",
  waste:       "#78716c",
  rail:        "#94a3b8",
  protected:   "#22c55e",
  university:  "#10b981",
  tvet:        "#14b8a6",
  corridor:    "#64748b",
};

/* ── Build pin SVG string ───────────────────────────────── */
function buildPinSvg(kind: string, color: string, isKey: boolean) {
  const pinW  = isKey ? 36 : 28;
  const r     = (pinW - 6) / 2;
  const cx    = pinW / 2;
  const cy    = r + 3;
  const tipY  = cy + r + 10;
  const pinH  = tipY + 2;
  const scale = (r * 0.80) / 9;
  const icon  = KIND_ICON_SVG[kind] ?? KIND_ICON_SVG.factory;
  const path  = [
    `M${cx},${tipY}`,
    `C${cx - r * 0.32},${cy + r * 0.92} 3,${cy + r * 0.6} 3,${cy}`,
    `a${r},${r} 0 1,1 ${pinW - 6},0`,
    `C${pinW - 3},${cy + r * 0.6} ${cx + r * 0.32},${cy + r * 0.92} ${cx},${tipY}Z`,
  ].join(" ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pinW}" height="${pinH}"
    style="overflow:visible;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.55)) drop-shadow(0 1px 3px rgba(0,0,0,0.4))">
    <path d="${path}" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <g transform="translate(${cx} ${cy}) scale(${scale.toFixed(3)})" fill="white" stroke="none" stroke-linecap="round" stroke-linejoin="round">
      ${icon}
    </g>
    <circle cx="${cx}" cy="${tipY}" r="1.8" fill="rgba(0,0,0,0.25)"/>
  </svg>`;

  return { svg, cx, cy, pinH, pinW };
}

/* ── Inject label CSS once ──────────────────────────────── */
function ZoomLabelController() {
  useEffect(() => {
    const id = "tgl-label-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = [
      ".pin-label { display:none; }",
      ".tgl-labels-key .pin-label-key { display:block; }",
      ".tgl-labels-all .pin-label { display:block; }",
    ].join(" ");
    document.head.appendChild(s);
    return () => { document.getElementById(id)?.remove(); };
  }, []);
  return null;
}

/* ── Inner map sub-components (must be inside <Map>) ────── */

function FlyController({ target }: { target: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    map.setZoom(target.zoom);
  }, [map, target]);
  return null;
}

function ZoomClassController({ wrapperRef }: { wrapperRef: React.RefObject<HTMLDivElement> }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const z  = map.getZoom() ?? 7;
      const el = wrapperRef.current;
      if (!el) return;
      el.classList.toggle("tgl-labels-key", z >= 9);
      el.classList.toggle("tgl-labels-all", z >= 11);
    };
    update();
    const listener = map.addListener("zoom_changed", update);
    return () => google.maps.event.removeListener(listener);
  }, [map, wrapperRef]);
  return null;
}

function CorridorLayer({ corridors }: { corridors: Corridor[] }) {
  const map = useMap();
  const polysRef = useRef<google.maps.Polyline[]>([]);
  const animRef  = useRef<number | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (!map) return;

    polysRef.current.forEach((p) => p.setMap(null));

    polysRef.current = corridors.map((c) =>
      new google.maps.Polyline({
        path: c.waypoints.map(([lat, lng]) => ({ lat, lng })),
        strokeColor:   c.color,
        strokeWeight:  3,
        strokeOpacity: 0,
        icons: [{
          icon: {
            path:          "M 0,-1 0,1",
            strokeOpacity: 0.85,
            strokeColor:   c.color,
            strokeWeight:  3,
            scale:         4,
          },
          offset: "0",
          repeat: "26px",
        }],
        map,
      })
    );

    const animate = () => {
      offsetRef.current = (offsetRef.current + 0.4) % 26;
      polysRef.current.forEach((p, i) => {
        const icons = p.get("icons") as google.maps.IconSequence[];
        if (icons?.[0]) {
          icons[0].offset = `${offsetRef.current}px`;
          p.set("icons", icons);
        }
        void i;
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      polysRef.current.forEach((p) => p.setMap(null));
      polysRef.current = [];
    };
  }, [map, corridors]);

  return null;
}

/* ── Build AdvancedMarker content element ───────────────── */
function buildMarkerElement(s: MapSite): HTMLDivElement {
  const color  = KIND_COLOR[s.kind] ?? LAYER_META[s.layer].color;
  const isKey  = (s.score ?? 0) >= 85;
  const { svg, cx, cy, pinW } = buildPinSvg(s.kind, color, isKey);

  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;cursor:pointer;";
  if (!s.coordVerified) wrap.style.opacity = "0.6";

  const pinEl = document.createElement("div");
  pinEl.innerHTML = svg;
  wrap.appendChild(pinEl);

  const label = document.createElement("div");
  label.className = `pin-label${isKey ? " pin-label-key" : ""}`;
  label.style.cssText = [
    `position:absolute`,
    `left:${pinW + 5}px`,
    `top:${cy}px`,
    `transform:translateY(-50%)`,
    `white-space:nowrap`,
    `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`,
    `font-size:11px`,
    `font-weight:700`,
    `letter-spacing:0.01em`,
    `color:#1a1a2e`,
    `background:rgba(255,255,255,0.88)`,
    `padding:1px 5px`,
    `border-radius:3px`,
    `box-shadow:0 1px 3px rgba(0,0,0,0.18)`,
    `pointer-events:none`,
  ].join(";");
  label.textContent = s.name;
  wrap.appendChild(label);

  return wrap;
}

function SiteMarkerLayer({
  sites, onSelect,
}: {
  sites: MapSite[];
  onSelect: (s: MapSite) => void;
}) {
  const map       = useMap();
  const markerLib = useMapsLibrary("marker");
  const advMarkersRef  = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const legMarkersRef  = useRef<google.maps.Marker[]>([]);
  const onSelectRef    = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!map) return;

    // cleanup
    advMarkersRef.current.forEach((m) => { m.map = null; });
    legMarkersRef.current.forEach((m) => m.setMap(null));
    advMarkersRef.current = [];
    legMarkersRef.current = [];

    if (markerLib) {
      // AdvancedMarkerElement path (requires valid mapId)
      advMarkersRef.current = sites.map((s) => {
        const content = buildMarkerElement(s);
        const marker  = new markerLib.AdvancedMarkerElement({
          map,
          position: { lat: s.lat, lng: s.lng },
          content,
          title: s.name,
        });
        marker.addListener("gmp-click", () => onSelectRef.current(s));
        return marker;
      });
    } else {
      // Legacy Marker fallback (no mapId required)
      legMarkersRef.current = sites.map((s) => {
        const color  = KIND_COLOR[s.kind] ?? LAYER_META[s.layer].color;
        const isKey  = (s.score ?? 0) >= 85;
        const { svg, cx, pinH, pinW } = buildPinSvg(s.kind, color, isKey);
        const marker = new google.maps.Marker({
          position: { lat: s.lat, lng: s.lng },
          map,
          title:   s.name,
          opacity: s.coordVerified ? 1 : 0.6,
          icon: {
            url:        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
            anchor:     new google.maps.Point(cx, pinH),
            scaledSize: new google.maps.Size(pinW, pinH),
          },
        });
        marker.addListener("click", () => onSelectRef.current(s));
        return marker;
      });
    }

    return () => {
      advMarkersRef.current.forEach((m) => { m.map = null; });
      legMarkersRef.current.forEach((m) => m.setMap(null));
      advMarkersRef.current = [];
      legMarkersRef.current = [];
    };
  }, [map, markerLib, sites]);

  return null;
}

function PinMarkerLayer({ position }: { position: { lat: number; lng: number } }) {
  const map       = useMap();
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map) return;

    const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48"
      style="overflow:visible;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.55))">
      <path d="M18,46 C12.5,37.5 3,30 3,18 a15,15 0 1,1 30,0 C33,30 23.5,37.5 18,46Z" fill="#ff5100"/>
      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <text x="18" y="23" text-anchor="middle" font-size="15" fill="white" font-family="sans-serif">★</text>
      <circle cx="18" cy="46" r="2" fill="rgba(0,0,0,0.25)"/>
    </svg>`;

    if (markerLib) {
      const content = document.createElement("div");
      content.innerHTML = pinSvg;
      const marker = new markerLib.AdvancedMarkerElement({ map, position, content, title: "Your location" });
      return () => { marker.map = null; };
    } else {
      const marker = new google.maps.Marker({
        position, map, title: "Your location",
        icon: {
          url:        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(pinSvg),
          anchor:     new google.maps.Point(18, 48),
          scaledSize: new google.maps.Size(36, 48),
        },
      });
      return () => { marker.setMap(null); };
    }
  }, [map, markerLib, position]);

  return null;
}

function FloodLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const layer = new google.maps.ImageMapType({
      getTileUrl: (coord, zoom) => {
        const b    = tileToBounds(coord.x, coord.y, zoom);
        const bbox = `${b.south},${b.west},${b.north},${b.east}`;
        return (
          "https://ows.globalfloods.eu/glofas-ows/ows.py?" +
          "SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0" +
          "&LAYERS=GloFAS_rp100&FORMAT=image/png&TRANSPARENT=true" +
          `&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=256&HEIGHT=256`
        );
      },
      tileSize: new google.maps.Size(256, 256),
      opacity:  0.45,
      name:     "GloFAS Flood Risk",
    });

    map.overlayMapTypes.push(layer);

    return () => {
      const arr = map.overlayMapTypes;
      for (let i = 0; i < arr.getLength(); i++) {
        if (arr.getAt(i) === layer) { arr.removeAt(i); break; }
      }
    };
  }, [map]);

  return null;
}

/* ── Preview map ────────────────────────────────────────── */
const gKey   = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
const gMapId = import.meta.env.VITE_GOOGLE_MAP_ID  as string | undefined;

function PreviewMapInner() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const polys = CORRIDORS.map(
      (c) =>
        new google.maps.Polyline({
          path:          c.waypoints.map(([lat, lng]) => ({ lat, lng })),
          strokeColor:   c.color,
          strokeWeight:  2,
          strokeOpacity: 0.6,
          map,
        }),
    );
    return () => polys.forEach((p) => p.setMap(null));
  }, [map]);

  return null;
}

function PreviewMapView() {
  return (
    <APIProvider apiKey={gKey ?? ""} libraries={["marker"]}>
      <Map
        style={{ height: "100%", width: "100%" }}
        defaultCenter={{ lat: 12.5, lng: 104.9 }}
        defaultZoom={7}
        minZoom={6}
        maxZoom={8}
        mapTypeId="roadmap"
        styles={DARK_STYLES}
        mapId={gMapId}
        disableDefaultUI
        gestureHandling="none"
        backgroundColor="#0d1117"
        onClick={undefined}
      >
        <PreviewMapInner />
      </Map>
    </APIProvider>
  );
}

/* ── Props ──────────────────────────────────────────────── */
interface IndustrialMapProps {
  previewMode?: boolean;
}

/* ── Main export ────────────────────────────────────────── */
export function IndustrialMap({ previewMode = false }: IndustrialMapProps) {
  const { t }               = useLang();
  const { data: sites = SITES } = useMapSites();
  const [active, setActive] = useState<Set<LayerGroup>>(new Set(ALL_LAYERS));
  const [selected, setSelected] = useState<MapSite | null>(null);
  const [query, setQuery]   = useState("");
  const [subKinds, setSubKinds] = useState<Partial<Record<LayerGroup, SiteKind | "all">>>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [basemap, setBasemap]     = useState<BasemapKey>(themeBasemap);
  const [floodVisible, setFloodVisible] = useState(false);
  const basemapUserPicked = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null!);

  /* Sync basemap with page theme */
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
    if (BASEMAPS[key].floodOverlay) setFloodVisible(true);
    try { localStorage.setItem("tgl_basemap", key); } catch { /* */ }
  };

  /* Location search */
  const [locationInput, setLocationInput] = useState("");
  const [pinTarget, setPinTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [pinMarker, setPinMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [locSearching, setLocSearching] = useState(false);
  const [locError, setLocError]         = useState("");

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
  }, [active, query, subKinds, previewMode, sites]);

  const visibleCorridors = useMemo(
    () => (active.has("corridors") ? CORRIDORS : []),
    [active],
  );

  const toggle = (g: LayerGroup) =>
    setActive((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });

  const setSubKind = (layer: LayerGroup, kind: SiteKind | "all") =>
    setSubKinds((prev) => ({ ...prev, [layer]: kind }));

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

  const handleSelect = useCallback((s: MapSite) => setSelected(s), []);

  /* ── Preview mode ───────────────────────────────────────── */
  if (previewMode) {
    return (
      <div className="relative w-full h-full" style={{ pointerEvents: "none" }}>
        <PreviewMapView />
      </div>
    );
  }

  const bm = BASEMAPS[basemap];

  /* ── Full map ───────────────────────────────────────────── */
  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full bg-black" ref={wrapperRef}>
      {/* Map container */}
      <div className="absolute inset-0">
        <APIProvider apiKey={gKey ?? ""} libraries={["marker"]}>
          <Map
            style={{ height: "100%", width: "100%" }}
            defaultCenter={{ lat: 12.2, lng: 104.9 }}
            defaultZoom={7}
            minZoom={6}
            maxZoom={17}
            mapTypeId={bm.mapTypeId}
            styles={bm.styles}
            disableDefaultUI
            gestureHandling="greedy"
            backgroundColor="#0d1117"
            onClick={() => setSelected(null)}
          >
            <FlyController target={pinTarget} />
            <ZoomLabelController />
            <ZoomClassController wrapperRef={wrapperRef} />

            {(floodVisible || bm.floodOverlay) && <FloodLayer />}

            <CorridorLayer corridors={visibleCorridors} />
            <SiteMarkerLayer sites={visible} onSelect={handleSelect} />
            {pinMarker && <PinMarkerLayer position={pinMarker} />}
          </Map>
        </APIProvider>
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

      {/* ── Layer panel (left side) ────────────────────────── */}
      <div className="absolute top-4 left-4 z-[500] flex flex-col gap-2">
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

        {panelOpen && (
          <div className="w-72 bg-black/95 backdrop-blur border border-white/10 text-white shadow-2xl"
            style={{ maxHeight: "calc(100vh - 7rem)", overflowY: "auto" }}>
            <div className="px-4 py-3 border-b border-white/10">
              <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>
                Cambodia Industrial Map
              </p>
              <p className="font-extrabold text-sm uppercase tracking-tight mt-0.5">{t("map.layerControl")}</p>
            </div>

            <div className="border-b border-white/10">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("map.searchSite")}
                className="w-full px-4 py-2.5 bg-transparent text-xs placeholder:text-white/30 focus:outline-none"
              />
            </div>

            {/* Flood overlay toggle */}
            <div className="border-b border-white/10">
              <button
                onClick={() => setFloodVisible((v) => !v)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition"
              >
                <span className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: "#38bdf8", opacity: floodVisible ? 1 : 0.25,
                    boxShadow: floodVisible ? "0 0 8px #38bdf8" : "none" }} />
                <span className="flex-1">
                  <span className="block text-xs font-bold uppercase tracking-wide">Flood Risk</span>
                  <span className="block text-[10px] text-white/40 mt-0.5">Global flood depth overlay (1-in-100yr)</span>
                </span>
                <span className={`w-7 h-4 rounded-full relative transition ${floodVisible ? "bg-[#38bdf8]" : "bg-white/15"}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${floodVisible ? "left-3.5" : "left-0.5"}`} />
                </span>
              </button>
            </div>

            {/* Layers */}
            {ALL_LAYERS.map((g, i) => {
              const meta    = LAYER_META[g];
              const on      = active.has(g);
              const count   = g === "corridors" ? CORRIDORS.length : SITES.filter((s) => s.layer === g).length;
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
                    <span className={`w-7 h-4 rounded-full relative transition ${on ? "bg-[#ff5100]" : "bg-white/15"}`}>
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`} />
                    </span>
                  </button>

                  {subDefs && on && (
                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                      {subDefs.map((k) => (
                        <button
                          key={k.value}
                          onClick={() => setSubKind(g, k.value)}
                          className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest border transition-all"
                          style={{
                            backgroundColor: curSub === k.value ? `${meta.color}22` : "transparent",
                            borderColor:     curSub === k.value ? meta.color         : "var(--map-subchip-border)",
                            color:           curSub === k.value ? meta.color         : "var(--map-subchip-text)",
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
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(BASEMAPS) as [BasemapKey, BasemapDef][]).map(([key, bm]) => {
                  const isActive = basemap === key;
                  return (
                    <button
                      key={key}
                      onClick={() => pickBasemap(key)}
                      className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest border transition-all"
                      style={{
                        backgroundColor: isActive ? "#ff5100" : `${bm.swatch}44`,
                        borderColor:     isActive ? "#ff5100" : "rgba(255,255,255,0.12)",
                        color:           isActive ? "#000"    : "rgba(255,255,255,0.55)",
                      }}
                    >
                      {bm.label}
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

      {selected && <Inspector site={selected} onClose={() => setSelected(null)} t={t} />}
    </div>
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

      <div className="shrink-0 border-b border-white/10">
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

      <div className="overflow-y-auto flex-1">

        {site.notes && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-[12px] text-white/75 leading-relaxed">{site.notes}</p>
          </div>
        )}

        {(site.size || site.utilities || site.road) && (
          <div className="border-b border-white/8">
            <p className="px-4 pt-3 pb-1.5 font-mono text-[9px] uppercase tracking-widest text-white/35">Details</p>
            <dl className="px-4 pb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[11px]">
              {site.size      && <Row k="Size"        v={site.size}      />}
              {site.utilities && <Row k="Utilities"   v={site.utilities} />}
              {site.road      && <Row k="Road Access" v={site.road}      />}
            </dl>
          </div>
        )}

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

        {site.recommendation && (
          <div className="px-4 py-3 border-b border-white/8 bg-[#ff510008]">
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: "#ff5100" }}>
              ◈ GentryLab Advisory
            </p>
            <p className="text-[11.5px] text-white/85 leading-relaxed">{site.recommendation}</p>
          </div>
        )}

        <div className="px-4 py-3 border-b border-white/8">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 w-full py-2.5 border border-white/15 hover:border-white/35 hover:bg-white/5 transition group">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#34A853" stroke="none"/>
              <circle cx="12" cy="9" r="2.5" fill="white" stroke="none"/>
            </svg>
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/70 group-hover:text-white transition">
              Open in Google Maps ↗
            </span>
          </a>
          <div className="flex items-center justify-between mt-1.5">
            <p className="font-mono text-[9px] text-white/25">
              {site.lat.toFixed(5)}, {site.lng.toFixed(5)}
            </p>
            {site.coordVerified ? (
              <span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5"
                style={{ color: "#34d399", backgroundColor: "#34d39915" }}>
                ✓ verified
              </span>
            ) : (
              <span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5"
                style={{ color: "#fbbf24", backgroundColor: "#fbbf2415" }}>
                ⚠ estimated
              </span>
            )}
          </div>
          {!site.coordVerified && (
            <p className="font-mono text-[8px] text-white/30 mt-1">
              Location approximate — verify on Google Maps before use
            </p>
          )}
        </div>

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
