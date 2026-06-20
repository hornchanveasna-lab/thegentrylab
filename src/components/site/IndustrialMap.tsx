import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useLang } from "@/lib/i18n";
import { useMapSites, useResearch } from "@/lib/data";
import {
  CORRIDORS,
  LAYER_META,
  RESEARCH,
  SITES,
  type Corridor,
  type LayerGroup,
  type MapSite,
  type ResearchBrief,
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
  { featureType: "road.highway",         elementType: "geometry",         stylers: [{ color: "#1e2d3a" }] },
  { featureType: "road.highway",         elementType: "geometry.stroke",  stylers: [{ color: "#2e4055" }, { weight: 1.5 }] },
  { featureType: "road.highway",         elementType: "labels.text.fill", stylers: [{ color: "#7a99b0" }] },
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
  { featureType: "road.highway",         elementType: "geometry",         stylers: [{ color: "#c8b89a" }] },
  { featureType: "road.highway",         elementType: "geometry.stroke",  stylers: [{ color: "#a89880" }, { weight: 0.6 }] },
  { featureType: "road.highway",         elementType: "labels.text.fill", stylers: [{ color: "#3d3020" }] },
  { featureType: "road.arterial",        elementType: "geometry",         stylers: [{ color: "#ddd8d0" }] },
  { featureType: "road.local",           elementType: "geometry",         stylers: [{ color: "#e8e3dc" }] },
  { featureType: "poi",                  stylers: [{ visibility: "off" }] },
  { featureType: "transit",             stylers: [{ visibility: "off" }] },
  { featureType: "water",               elementType: "geometry",         stylers: [{ color: "#b3d4e8" }] },
  { featureType: "landscape",           elementType: "geometry",         stylers: [{ color: "#f0ece5" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#b0a090" }, { weight: 1.5 }] },
];

/* ── Basemap definitions ─────────────────────────────────── */
type BasemapKey = "standard" | "dark" | "light" | "terrain" | "satellite" | "flood";
interface BasemapDef {
  label: string;
  mapTypeId: string;
  styles?: google.maps.MapTypeStyle[];
  isDark: boolean;
  swatch: string;
  floodOverlay?: boolean;
}

const BASEMAPS: Record<BasemapKey, BasemapDef> = {
  standard:  { label: "Standard",  mapTypeId: "roadmap",  isDark: false, swatch: "#e8ecf0" },
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
    return "standard";
  } catch { return "standard"; }
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
  // investment layer — orange family
  sez:         "#f97316",
  park:        "#fb923c",
  factory:     "#ef4444",
  logistics:   "#eab308",
  // infrastructure layer — yellow family
  port:        "#f59e0b",
  airport:     "#facc15",
  rail:        "#ca8a04",
  // energy layer — purple family
  substation:  "#a855f7",
  powerplant:  "#c084fc",
  solar:       "#d946ef",
  // water layer — blue family
  water_plant: "#38bdf8",
  // environment layer — green family
  protected:   "#22c55e",
  waste:       "#4ade80",
  // labor layer — indigo/violet family
  university:  "#a78bfa",
  tvet:        "#818cf8",
  hospital:    "#c4b5fd",
  // corridors
  corridor:    "#64748b",
};

/* ── Build pin SVG string ───────────────────────────────── */
function buildPinSvg(kind: string, color: string, isKey: boolean) {
  // Extra padding around the pin so the SVG-internal shadow doesn't clip
  const pad   = 6;
  const pinW  = isKey ? 36 : 28;
  const r     = (pinW - 6) / 2;
  const cx    = pinW / 2 + pad;
  const cy    = r + 3 + pad;
  const tipY  = cy + r + 10;
  const pinH  = tipY + pad + 4;
  const totalW = pinW + pad * 2;
  const scale = (r * 0.80) / 9;
  const icon  = KIND_ICON_SVG[kind] ?? KIND_ICON_SVG.factory;
  const path  = [
    `M${cx},${tipY}`,
    `C${cx - r * 0.32},${cy + r * 0.92} ${pad + 3},${cy + r * 0.6} ${pad + 3},${cy}`,
    `a${r},${r} 0 1,1 ${pinW - 6},0`,
    `C${pinW - 3 + pad},${cy + r * 0.6} ${cx + r * 0.32},${cy + r * 0.92} ${cx},${tipY}Z`,
  ].join(" ");

  // Shadow lives inside the SVG — no CSS filter, no overflow:visible, no gray box
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${pinH}">
    <defs>
      <filter id="ps" x="-40%" y="-20%" width="180%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
      </filter>
    </defs>
    <path d="${path}" fill="${color}" filter="url(#ps)"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <g transform="translate(${cx} ${cy}) scale(${scale.toFixed(3)})" fill="white" stroke="none" stroke-linecap="round" stroke-linejoin="round">
      ${icon}
    </g>
    <circle cx="${cx}" cy="${tipY}" r="1.8" fill="rgba(0,0,0,0.25)"/>
  </svg>`;

  return { svg, cx, cy, pinH, pinW: totalW };
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

function SiteMarkerLayer({
  sites, onSelect, onHover,
}: {
  sites: MapSite[];
  onSelect: (s: MapSite) => void;
  onHover: (s: MapSite | null) => void;
}) {
  const map         = useMap();
  const markersRef  = useRef<google.maps.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const onHoverRef  = useRef(onHover);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onHoverRef.current  = onHover;  }, [onHover]);

  useEffect(() => {
    if (!map) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    markersRef.current = sites.map((s) => {
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
      marker.addListener("mouseover", () => onHoverRef.current(s));
      marker.addListener("mouseout",  () => onHoverRef.current(null));
      return marker;
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, sites]);

  return null;
}

function PinMarkerLayer({ position }: { position: { lat: number; lng: number } }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="58">
      <defs>
        <filter id="ps2" x="-40%" y="-20%" width="180%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
      </defs>
      <path d="M24,54 C18.5,45.5 9,38 9,26 a15,15 0 1,1 30,0 C39,38 29.5,45.5 24,54Z" fill="#ff5100" filter="url(#ps2)"/>
      <circle cx="24" cy="26" r="14" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <text x="24" y="31" text-anchor="middle" font-size="15" fill="white" font-family="sans-serif">★</text>
      <circle cx="24" cy="54" r="2" fill="rgba(0,0,0,0.25)"/>
    </svg>`;
    const marker = new google.maps.Marker({
      position, map, title: "Your location",
      icon: {
        url:        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
        anchor:     new google.maps.Point(24, 56),
        scaledSize: new google.maps.Size(48, 58),
      },
    });
    return () => { marker.setMap(null); };
  }, [map, position]);

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

/* ── Province centroids for news markers ────────────────── */
const PROVINCE_CENTROIDS: Record<string, [number, number]> = {
  "Phnom Penh":        [11.5564, 104.9282],
  "Kandal":            [11.2833, 104.9500],
  "Kampong Speu":      [11.4500, 104.5200],
  "Preah Sihanouk":    [10.6167, 103.5167],
  "Sihanoukville":     [10.6167, 103.5167],
  "Svay Rieng":        [11.0833, 105.8000],
  "Kampong Cham":      [11.9931, 105.4636],
  "Kampot":            [10.5933, 104.1667],
  "Takeo":             [10.9833, 104.7833],
  "Prey Veng":         [11.4833, 105.3333],
  "Kampong Chhnang":   [12.2500, 104.6667],
  "Kampong Thom":      [12.7111, 104.8900],
  "Siem Reap":         [13.3622, 103.8597],
  "Battambang":        [13.0957, 103.2022],
  "Preah Vihear":      [13.8000, 104.9833],
  "Pursat":            [12.5339, 103.9192],
  "Kratie":            [12.4878, 106.0189],
  "Stung Treng":       [13.5239, 105.9697],
  "Ratanakiri":        [13.7394, 106.9875],
  "Mondulkiri":        [12.4500, 107.1833],
  "Koh Kong":          [11.6167, 103.0000],
  "Oddar Meanchey":    [14.1806, 103.5178],
  "Kep":               [10.4833, 104.3167],
  "Pailin":            [12.8500, 102.6000],
  "Nationwide":        [12.5657, 104.9910],
};

/* ── News marker SVG ────────────────────────────────────── */
function buildNewsSvg(count: number) {
  const w = 30, h = 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
    style="overflow:visible;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.55))">
    <rect x="1" y="1" width="28" height="28" rx="5" fill="#f59e0b"/>
    <rect x="1" y="1" width="28" height="28" rx="5" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
    <text x="15" y="19" text-anchor="middle" font-size="14" font-family="sans-serif">📰</text>
    ${count > 1 ? `<circle cx="24" cy="6" r="7" fill="#ff5100"/>
    <text x="24" y="10" text-anchor="middle" font-size="8" font-weight="bold" fill="white" font-family="sans-serif">${count}</text>` : ""}
  </svg>`;
}

/* ── Project marker SVG ─────────────────────────────────── */
function buildProjectSvg(status: string) {
  const color = STATUS_COLOR[status] ?? "#818cf8";
  const s = 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"
    style="overflow:visible;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.55))">
    <rect x="${s/2}" y="1" width="${s - 2}" height="${s - 2}" rx="2" transform="rotate(45 ${s/2} ${s/2})" fill="${color}"/>
    <rect x="${s/2}" y="1" width="${s - 2}" height="${s - 2}" rx="2" transform="rotate(45 ${s/2} ${s/2})" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
  </svg>`;
}

/* ── Related research matcher ───────────────────────────── */
function getRelatedResearch(site: MapSite, research: ResearchBrief[]): ResearchBrief[] {
  const siteLower = site.province.toLowerCase();
  const industries = (site.targetIndustries ?? []).map((i) => i.toLowerCase());
  return research
    .filter((r) => {
      const cat = r.category.toLowerCase();
      const abs = r.abstract.toLowerCase();
      return (
        industries.some((ind) => abs.includes(ind) || cat.includes(ind)) ||
        abs.includes(siteLower) ||
        (site.kind === "sez" && abs.includes("sez")) ||
        (site.kind === "solar" && abs.includes("power")) ||
        (["university", "tvet", "hospital"].includes(site.kind) && abs.includes("labor")) ||
        (site.kind === "protected" && abs.includes("flood"))
      );
    })
    .slice(0, 3);
}

/* ── Preview map ────────────────────────────────────────── */
const gKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

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
    <APIProvider apiKey={gKey ?? ""}>
      <Map
        style={{ height: "100%", width: "100%" }}
        defaultCenter={{ lat: 12.5, lng: 104.9 }}
        defaultZoom={7}
        minZoom={6}
        maxZoom={8}
        mapTypeId="roadmap"
        styles={DARK_STYLES}
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
  const { data: sites = SITES }          = useMapSites();
  const { data: allResearch = RESEARCH } = useResearch();
  const [active, setActive] = useState<Set<LayerGroup>>(new Set(ALL_LAYERS));
  const [selected, setSelected] = useState<MapSite | null>(null);
  const [query, setQuery]   = useState("");
  const [subKinds, setSubKinds] = useState<Partial<Record<LayerGroup, SiteKind | "all">>>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [basemap, setBasemap]     = useState<BasemapKey>(themeBasemap);
  const [floodVisible, setFloodVisible] = useState(false);
  const [hoveredSite, setHoveredSite] = useState<MapSite | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const basemapUserPicked = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null!);

  /* Sync basemap with page theme */
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (basemapUserPicked.current) return;
      const theme = document.documentElement.getAttribute("data-theme") ?? "dark";
      setBasemap(theme === "light" ? "standard" : "dark");
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
  const [suggestions, setSuggestions]   = useState<{ placeId: string; main: string; secondary: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  /* Fetch Places Autocomplete suggestions */
  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:kh&language=en&key=${gKey}`
      );
      const data = await res.json();
      setSuggestions(
        (data.predictions ?? []).slice(0, 5).map((p: { place_id: string; structured_formatting: { main_text: string; secondary_text: string } }) => ({
          placeId: p.place_id,
          main:      p.structured_formatting?.main_text ?? p.place_id,
          secondary: p.structured_formatting?.secondary_text ?? "",
        }))
      );
    } catch { setSuggestions([]); }
  }, [gKey]);

  /* Pick a suggestion — fetch its coords via Place Details */
  const pickSuggestion = useCallback(async (s: { placeId: string; main: string; secondary: string }) => {
    setLocationInput(s.main);
    setSuggestions([]);
    setShowSuggestions(false);
    setLocSearching(true);
    try {
      const res  = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${s.placeId}&fields=geometry&key=${gKey}`
      );
      const data = await res.json();
      const loc  = data.result?.geometry?.location;
      if (loc) {
        setPinMarker({ lat: loc.lat, lng: loc.lng });
        setPinTarget({ lat: loc.lat, lng: loc.lng, zoom: 14 });
      }
    } catch { /* ignore */ }
    setLocSearching(false);
  }, [gKey]);

  /* Dismiss suggestions on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Location callout (empty-map click, Google Maps style) */
  const [locCallout, setLocCallout] = useState<{
    lat: number; lng: number;
    address: string | null;
    plusCode: string | null;
    loading: boolean;
  } | null>(null);

  const handleMapClick = useCallback(async (e: { detail: { latLng: { lat: number; lng: number } | null } }) => {
    const ll = e.detail.latLng;
    if (!ll) return;
    setSelected(null);
    setLocCallout({ lat: ll.lat, lng: ll.lng, address: null, plusCode: null, loading: true });
    try {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${ll.lat},${ll.lng}&key=${gKey}`
      );
      const j = await r.json();
      /* Prefer a named locality over Plus Code */
      const named = j.results?.find((x: { types: string[] }) =>
        x.types?.some((t: string) => ["locality","sublocality","neighborhood","natural_feature","establishment","point_of_interest"].includes(t))
      );
      const plusCode = j.plus_code?.global_code ?? null;
      const address = named?.address_components?.[0]?.long_name ?? j.results?.[0]?.formatted_address?.split(",")[0] ?? null;
      setLocCallout({ lat: ll.lat, lng: ll.lng, address, plusCode, loading: false });
    } catch {
      setLocCallout((c) => c ? { ...c, loading: false } : null);
    }
  }, [gKey]);

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

  const handleSelect = useCallback((s: MapSite) => {
    setSelected(s);
    setLocCallout(null);
    setPanelOpen(false);
  }, []);

  /* layer counts per group */
  const layerCounts = useMemo(() => {
    const counts: Partial<Record<LayerGroup, number>> = {};
    for (const s of sites) counts[s.layer] = (counts[s.layer] ?? 0) + 1;
    return counts;
  }, [sites]);

  /* ── Preview mode ───────────────────────────────────────── */
  if (previewMode) {
    return (
      <div className="relative w-full h-full" style={{ pointerEvents: "none" }}>
        <PreviewMapView />
      </div>
    );
  }

  const bm = BASEMAPS[basemap];
  const isDark = bm.isDark;

  /* ── Full map ───────────────────────────────────────────── */
  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full bg-black" ref={wrapperRef}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      {/* Map canvas */}
      <div className="absolute inset-0">
        <APIProvider apiKey={gKey ?? ""}>
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
            onClick={handleMapClick}
          >
            <FlyController target={pinTarget} />
            <ZoomLabelController />
            <ZoomClassController wrapperRef={wrapperRef} />

            {(floodVisible || bm.floodOverlay) && <FloodLayer />}

            <CorridorLayer corridors={visibleCorridors} />
            <SiteMarkerLayer sites={visible} onSelect={handleSelect} onHover={setHoveredSite} />
            {pinMarker && <PinMarkerLayer position={pinMarker} />}
          </Map>
        </APIProvider>
      </div>

      {/* ── Search bar (top-center) ────────────────────────── */}
      <div ref={searchWrapRef} className="absolute top-4 left-1/2 -translate-x-1/2 z-[600] w-[min(440px,calc(100vw-340px))]">
        <form
          onSubmit={(e) => { e.preventDefault(); setSuggestions([]); setShowSuggestions(false); handleLocationSearch(); }}
          className="flex items-center bg-black/95 backdrop-blur border border-white/15 shadow-2xl"
          style={{ borderRadius: showSuggestions && suggestions.length > 0 ? "4px 4px 0 0" : "4px" }}
        >
          {locSearching ? (
            <div className="ml-3 w-3.5 h-3.5 shrink-0 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          ) : (
            <svg className="ml-3 shrink-0 text-white/35" width="14" height="14" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          )}
          <input
            value={locationInput}
            onChange={(e) => {
              const v = e.target.value;
              setLocationInput(v);
              setLocError("");
              setShowSuggestions(true);
              if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
              autocompleteTimer.current = setTimeout(() => fetchSuggestions(v), 220);
            }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            onKeyDown={(e) => { if (e.key === "Escape") { setSuggestions([]); setShowSuggestions(false); } }}
            placeholder={t("map.searchPlaceholder")}
            className="flex-1 px-3 py-3 text-[13px] text-white bg-transparent placeholder:text-white/30 focus:outline-none"
          />
          {locationInput && (
            <button type="button"
              onClick={() => { setLocationInput(""); setPinMarker(null); setLocError(""); setSuggestions([]); setShowSuggestions(false); }}
              className="text-white/30 hover:text-white/80 px-2.5 text-lg leading-none transition">✕</button>
          )}
        </form>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="border border-t-0 border-white/15 bg-black/95 backdrop-blur shadow-2xl overflow-hidden" style={{ borderRadius: "0 0 4px 4px" }}>
            {suggestions.map((s, i) => (
              <button
                key={s.placeId}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition text-left"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-white/30">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor"/>
                  <circle cx="12" cy="9" r="2.5" fill="black" opacity="0.4"/>
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white/90 truncate">{s.main}</p>
                  {s.secondary && <p className="text-[11px] text-white/40 truncate">{s.secondary}</p>}
                </div>
              </button>
            ))}
            <div className="px-4 py-1.5 flex justify-end border-t border-white/5">
              <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-non-white.png" alt="Powered by Google" className="h-3.5 opacity-40" />
            </div>
          </div>
        )}

        {locError && (
          <p className="mt-1 text-[10px] font-mono text-red-400 text-center bg-black/80 px-3 py-1">{locError}</p>
        )}
      </div>

      {/* ── Layer panel toggle (top-left) ─────────────────── */}
      <div className="absolute top-4 left-4 z-[500] flex flex-col gap-2">
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-2 bg-black/90 backdrop-blur border border-white/15 hover:border-white/30 transition shadow-xl"
          title="Toggle layers"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="1.3">
            <line x1="1" y1="3.5" x2="13" y2="3.5"/><line x1="1" y1="7" x2="13" y2="7"/><line x1="1" y1="10.5" x2="13" y2="10.5"/>
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/60">Layers</span>
          <span className="font-mono text-[9px] text-white/30">{active.size}/{ALL_LAYERS.length}</span>
        </button>
      </div>

      {/* ── Layer panel ───────────────────────────────────── */}
      {panelOpen && (
        <div className="absolute top-14 left-4 z-[500] w-[220px] bg-black/95 backdrop-blur border border-white/12 shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">Map Layers</span>
            <button onClick={() => setPanelOpen(false)} className="text-white/30 hover:text-white text-xs">✕</button>
          </div>

          <div className="p-2 space-y-0.5">
            {ALL_LAYERS.map((layer) => {
              const meta = LAYER_META[layer];
              const on   = active.has(layer);
              const cnt  = layerCounts[layer] ?? 0;
              const subkinds = LAYER_SUBKINDS[layer];
              return (
                <div key={layer}>
                  <button
                    onClick={() => toggle(layer)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:bg-white/5 transition rounded-sm text-left"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                      style={{ backgroundColor: meta.color, opacity: on ? 1 : 0.25 }} />
                    <span className={`font-mono text-[10px] uppercase tracking-wider flex-1 transition-opacity ${on ? "text-white/80" : "text-white/25"}`}>
                      {meta.label}
                    </span>
                    {cnt > 0 && (
                      <span className="font-mono text-[9px] text-white/25">{cnt}</span>
                    )}
                    <span className={`font-mono text-[8px] transition ${on ? "text-white/50" : "text-white/20"}`}>
                      {on ? "ON" : "OFF"}
                    </span>
                  </button>
                  {on && subkinds && (
                    <div className="pl-5 pb-1 flex flex-wrap gap-1">
                      {subkinds.map((sk) => (
                        <button
                          key={sk.value}
                          onClick={() => setSubKind(layer, sk.value)}
                          className="px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider border transition"
                          style={{
                            borderColor: (subKinds[layer] ?? "all") === sk.value ? meta.color : "rgba(255,255,255,0.1)",
                            color: (subKinds[layer] ?? "all") === sk.value ? meta.color : "rgba(255,255,255,0.3)",
                            backgroundColor: (subKinds[layer] ?? "all") === sk.value ? `${meta.color}15` : "transparent",
                          }}
                        >
                          {sk.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Basemap switcher */}
          <div className="border-t border-white/8 p-2">
            <p className="px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white/30">Basemap</p>
            <div className="flex flex-wrap gap-1.5 px-2 pb-1">
              {(Object.entries(BASEMAPS) as [BasemapKey, BasemapDef][]).map(([key, def]) => (
                <button
                  key={key}
                  onClick={() => pickBasemap(key)}
                  title={def.label}
                  className="flex items-center gap-1 px-2 py-1 font-mono text-[8px] uppercase tracking-wider border transition"
                  style={{
                    borderColor: basemap === key ? "#ff5100" : "rgba(255,255,255,0.1)",
                    color:       basemap === key ? "#ff5100" : "rgba(255,255,255,0.35)",
                    backgroundColor: basemap === key ? "#ff510015" : "transparent",
                  }}
                >
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: def.swatch }} />
                  {def.label}
                </button>
              ))}
            </div>
            <div className="px-2 pt-1">
              <button
                onClick={() => setFloodVisible((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1 font-mono text-[8px] uppercase tracking-wider border transition w-full"
                style={{
                  borderColor: floodVisible ? "#0ea5e9" : "rgba(255,255,255,0.1)",
                  color:       floodVisible ? "#0ea5e9" : "rgba(255,255,255,0.35)",
                  backgroundColor: floodVisible ? "#0ea5e915" : "transparent",
                }}
              >
                <span>GloFAS Flood Overlay</span>
                <span className="ml-auto">{floodVisible ? "ON" : "OFF"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Site inspector ────────────────────────────────── */}
      {selected && (
        <Inspector
          site={selected}
          research={allResearch}
          onClose={() => setSelected(null)}
          t={t}
          isDark={isDark}
        />
      )}
      {/* ── Site hover tooltip ───────────────────────────────── */}
      {hoveredSite && !selected && mousePos && (
        <SiteHoverTooltip site={hoveredSite} isDark={isDark} x={mousePos.x} y={mousePos.y} />
      )}

      {/* ── Location callout (empty-map click) ───────────────── */}
      {locCallout && !selected && (
        <LocationCallout
          lat={locCallout.lat}
          lng={locCallout.lng}
          address={locCallout.address}
          plusCode={locCallout.plusCode}
          loading={locCallout.loading}
          isDark={isDark}
          onClose={() => setLocCallout(null)}
        />
      )}
    </div>
  );
}

/* ── Site Hover Tooltip ──────────────────────────────────── */
function SiteHoverTooltip({ site, isDark, x, y }: { site: MapSite; isDark: boolean; x: number; y: number }) {
  const layerColor = LAYER_META[site.layer].color;
  const scoreColor = site.score !== undefined
    ? site.score >= 80 ? "#34d399" : site.score >= 65 ? "#fbbf24" : site.score >= 40 ? "#fb923c" : "#f43f5e"
    : null;
  const panelBg   = isDark ? "rgba(15,15,17,0.97)" : "rgba(255,255,255,0.97)";
  const textMain  = isDark ? "#f8fafc" : "#0f172a";
  const textMuted = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
  const borderCol = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

  // Position above the cursor; clamp to left edge so it never goes off-screen
  const tooltipW = 260;
  const left = Math.max(8, Math.min(x - tooltipW / 2, window.innerWidth - tooltipW - 8));
  const top  = y - 16; // offset upward from cursor — translateY(-100%) handles the rest

  return (
    <div
      className="absolute z-[450] pointer-events-none"
      style={{ left, top, width: tooltipW, transform: "translateY(calc(-100% - 12px))" }}
    >
      <div className="shadow-2xl backdrop-blur-sm px-4 py-3"
        style={{ backgroundColor: panelBg, border: `1px solid ${borderCol}` }}>
        {/* Marker color dot + layer */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: layerColor }} />
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: layerColor }}>
            {LAYER_META[site.layer].label} · {site.kind}
          </span>
        </div>
        {/* Name */}
        <p className="font-bold text-[14px] leading-snug mb-1" style={{ color: textMain }}>{site.name}</p>
        {/* Province + status */}
        <p className="text-[11px] mb-1.5" style={{ color: textMuted }}>
          {site.province}{site.status ? ` · ${site.status}` : ""}
        </p>
        {/* Score */}
        {site.score !== undefined && scoreColor && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${site.score}%`, backgroundColor: scoreColor }} />
            </div>
            <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor }}>{site.score}/100</span>
          </div>
        )}
        {/* Click hint */}
        <p className="font-mono text-[8px] uppercase tracking-widest mt-2" style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.25)" }}>
          Click to view details
        </p>
      </div>
      {/* Downward tail pointing at the marker */}
      <div className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-0 h-0"
        style={{ borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderTop: `9px solid ${borderCol}` }} />
      <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-0 h-0"
        style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: `8px solid ${panelBg}` }} />
    </div>
  );
}

/* ── Location Callout (empty-map click) ─────────────────── */
function LocationCallout({
  lat, lng, address, plusCode, loading, isDark, onClose,
}: {
  lat: number; lng: number;
  address: string | null;
  plusCode: string | null;
  loading: boolean;
  isDark: boolean;
  onClose: () => void;
}) {
  const panelBg   = isDark ? "#0d0d0e" : "#ffffff";
  const textMain  = isDark ? "#ffffff" : "#0f172a";
  const textMuted = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
  const textDim   = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)";
  const borderCol = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const dividerCol = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  /* Strip country suffix for cleaner display */
  const shortAddress = address
    ? address.replace(/, Cambodia$/, "").replace(/^Cambodia$/, "")
    : null;

  return (
    <div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[450] w-[300px] shadow-2xl"
      style={{ backgroundColor: panelBg, border: `1px solid ${borderCol}` }}
    >
      {/* Callout tail */}
      <div className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-0 h-0"
        style={{ borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderTop: `9px solid ${borderCol}` }} />
      <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-0 h-0"
        style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: `8px solid ${panelBg}` }} />

      <div className="px-4 py-3" style={{ borderBottom: `1px solid ${dividerCol}` }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-1.5">
                <div className="h-4 w-3/4 rounded animate-pulse" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }} />
                <div className="h-2.5 w-1/2 rounded animate-pulse" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }} />
              </div>
            ) : (
              <>
                {/* Place name first (like Google Maps), Plus Code only if no name */}
                {shortAddress ? (
                  <p className="font-semibold text-[15px] leading-tight" style={{ color: textMain }}>{shortAddress}</p>
                ) : plusCode ? (
                  <p className="font-mono font-bold text-[14px] leading-tight" style={{ color: textMain }}>{plusCode}</p>
                ) : null}
                {shortAddress && plusCode && (
                  <p className="font-mono text-[10px] mt-0.5" style={{ color: textMuted }}>{plusCode}</p>
                )}
                <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>Cambodia</p>
              </>
            )}
          </div>
          <button onClick={onClose}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-sm hover:opacity-70 transition mt-0.5"
            style={{ color: textDim }}>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M1 1l8 8M9 1L1 9"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-2.5">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 hover:opacity-80 transition">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#34A853"/>
            <circle cx="12" cy="9" r="2.5" fill="white"/>
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#4285F4" }}>
            View on Google Maps ↗
          </span>
        </a>
      </div>
    </div>
  );
}

/* ── Inspector ──────────────────────────────────────────── */
function Inspector({
  site, research, news, onClose, t, isDark,
}: {
  site: MapSite;
  research: ResearchBrief[];
  news: NewsItem[];
  onClose: () => void;
  t: (key: string) => string;
  isDark: boolean;
}) {
  const relatedResearch = getRelatedResearch(site, research);
  const relatedNews = news
    .filter((n) => n.province === site.province || n.province === "Nationwide")
    .slice(0, 2);
  const layerColor = LAYER_META[site.layer].color;
  const scoreColor = site.score !== undefined
    ? site.score >= 80 ? "#34d399" : site.score >= 65 ? "#fbbf24" : site.score >= 40 ? "#fb923c" : "#f43f5e"
    : "#94a3b8";
  const mapsUrl        = `https://www.google.com/maps/search/?api=1&query=${site.lat},${site.lng}`;
  const directionsUrl  = `https://www.google.com/maps/dir/?api=1&destination=${site.lat},${site.lng}`;
  const shareUrl       = `${window.location.origin}/map?site=${site.id}`;
  const kindSvg = KIND_SVG[site.kind] ?? KIND_SVG.factory;

  const panelBg    = isDark ? "#111113" : "#ffffff";
  const panelBg2   = isDark ? "#18181b" : "#f8f9fa";
  const borderCol  = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)";
  const textMain   = isDark ? "#f8fafc" : "#0f172a";
  const textMuted  = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)";
  const textDim    = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.28)";
  const dividerCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const cardBg     = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const accentBlue = isDark ? "#60a5fa" : "#1a73e8";

  const eipPillars = [
    { label: "Management",   value: site.eip_management,   color: "#818cf8" },
    { label: "Environment",  value: site.eip_environmental, color: "#34d399" },
    { label: "Social",       value: site.eip_social,        color: "#f59e0b" },
    { label: "Economic",     value: site.eip_economic,      color: "#0ea5e9" },
  ];
  const hasEip = eipPillars.some((p) => p.value != null);

  /* Feature chips derived from data */
  const featureChips: string[] = [];
  if (site.status) featureChips.push(site.status);
  if (site.utilities?.toLowerCase().includes("edc") || site.utilities?.toLowerCase().includes("electric")) featureChips.push("EDC Power");
  if (site.utilities?.toLowerCase().includes("water")) featureChips.push("Water Supply");
  if (site.road) featureChips.push("Road Access");
  if (site.flood_risk === false) featureChips.push("Low Flood Risk");
  if (site.flood_risk === true) featureChips.push("⚠ Flood Risk");
  if (site.coordVerified) featureChips.push("GPS Verified");

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${site.lat.toFixed(6)}, ${site.lng.toFixed(6)}`).catch(() => {});
  };
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: site.name, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
  };

  return (
    <aside
      className="absolute top-0 right-0 z-[400] w-[360px] max-w-[calc(100vw-2rem)] flex flex-col h-full max-h-full overflow-hidden shadow-2xl"
      style={{ backgroundColor: panelBg, borderLeft: `1px solid ${borderCol}` }}
    >
      {/* ── Hero image / gradient header ── */}
      <div className="relative shrink-0">
        {site.image_url ? (
          <img
            src={site.image_url}
            alt={site.name}
            className="w-full h-[180px] object-cover object-center"
            style={{ filter: "brightness(0.78) contrast(1.1)" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-[120px] flex items-center justify-center"
            style={{ background: `linear-gradient(145deg, ${layerColor}28 0%, ${panelBg} 100%)` }}>
            <div dangerouslySetInnerHTML={{ __html:
              `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" style="opacity:0.2">
                <g fill="none" stroke="${layerColor}" stroke-width="1">${kindSvg}</g>
              </svg>`
            }} />
          </div>
        )}
        {/* Close button floated top-right over image */}
        <button onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)" }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l8 8M9 1L1 9"/>
          </svg>
        </button>
        {/* Province badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider backdrop-blur-sm rounded-sm"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.8)" }}>
            {site.province}
          </span>
        </div>
      </div>

      {/* ── Name + meta ── */}
      <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: `1px solid ${dividerCol}` }}>
        <h2 className="font-bold text-[17px] leading-tight mb-1" style={{ color: textMain }}>{site.name}</h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px]" style={{ color: textMuted }}>
            {LAYER_META[site.layer].label}
          </span>
          <span style={{ color: textDim }}>·</span>
          <span className="text-[12px] capitalize" style={{ color: textMuted }}>{site.kind}</span>
          {site.score !== undefined && (
            <>
              <span style={{ color: textDim }}>·</span>
              <span className="font-bold text-[12px]" style={{ color: scoreColor }}>{site.score}/100</span>
              {site.eip_tier && (
                <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    color: site.eip_tier === "gold" ? "#fbbf24" : site.eip_tier === "silver" ? "#94a3b8" : "#f97316",
                    backgroundColor: site.eip_tier === "gold" ? "#fbbf2418" : site.eip_tier === "silver" ? "#94a3b818" : "#f9731618",
                  }}>
                  {site.eip_tier}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Action buttons (Google Maps style) ── */}
      <div className="flex items-center justify-around px-3 py-3 shrink-0" style={{ borderBottom: `1px solid ${dividerCol}` }}>
        {[
          {
            label: "Directions",
            href: directionsUrl,
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" fill="currentColor" stroke="none"/>
              </svg>
            ),
          },
          {
            label: "Maps",
            href: mapsUrl,
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#34A853"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
              </svg>
            ),
          },
          {
            label: "Coords",
            onClick: handleCopyCoords,
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            ),
          },
          {
            label: "Share",
            onClick: handleShare,
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            ),
          },
        ].map((btn) => (
          btn.href ? (
            <a key={btn.label} href={btn.href} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 group">
              <div className="w-10 h-10 rounded-full flex items-center justify-center transition group-hover:brightness-90"
                style={{ backgroundColor: panelBg2, color: accentBlue }}>
                {btn.icon}
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: accentBlue }}>{btn.label}</span>
            </a>
          ) : (
            <button key={btn.label} onClick={btn.onClick}
              className="flex flex-col items-center gap-1.5 group">
              <div className="w-10 h-10 rounded-full flex items-center justify-center transition group-hover:brightness-90"
                style={{ backgroundColor: panelBg2, color: accentBlue }}>
                {btn.icon}
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: accentBlue }}>{btn.label}</span>
            </button>
          )
        ))}
      </div>

      {/* ── Scrollable content ── */}
      <div className="overflow-y-auto flex-1">

        {/* Feature chips row */}
        {featureChips.length > 0 && (
          <div className="px-4 py-3 flex flex-wrap gap-1.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            {featureChips.map((chip) => (
              <span key={chip}
                className="text-[11px] px-2.5 py-1 rounded-full border"
                style={{
                  borderColor: chip.includes("⚠") ? "#f43f5e55" : chip === "Low Flood Risk" ? "#34d39955" : borderCol,
                  color: chip.includes("⚠") ? "#f43f5e" : chip === "Low Flood Risk" ? "#34d399" : textMuted,
                  backgroundColor: chip.includes("⚠") ? "#f43f5e0a" : chip === "Low Flood Risk" ? "#34d3990a" : "transparent",
                }}>
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* Quick stat tiles: port, elevation, area, road */}
        {(site.port_distance_km != null || site.elevation_m != null || site.size || site.road) && (
          <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: dividerCol, borderBottom: `1px solid ${dividerCol}` }}>
            {site.port_distance_km != null && (
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: panelBg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17h18M5 17V7l7-4 7 4v10"/><rect x="9" y="11" width="6" height="6"/>
                </svg>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-0.5" style={{ color: textDim }}>Port</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{Math.round(site.port_distance_km)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>km</span></p>
                </div>
              </div>
            )}
            {site.elevation_m != null && (
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: panelBg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 20 22 20"/>
                </svg>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-0.5" style={{ color: textDim }}>Elevation</p>
                  <p className="font-semibold text-[13px] leading-none"
                    style={{ color: site.elevation_m >= 5 ? "#34d399" : site.elevation_m >= 2 ? "#fbbf24" : "#f43f5e" }}>
                    {Math.round(site.elevation_m)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>m</span>
                  </p>
                </div>
              </div>
            )}
            {site.size && (
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: panelBg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                </svg>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-0.5" style={{ color: textDim }}>Area</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{site.size}</p>
                </div>
              </div>
            )}
            {site.road && (
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: panelBg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 20V4M21 20V4M8 20V4M16 20V4"/>
                </svg>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-0.5" style={{ color: textDim }}>Road</p>
                  <p className="font-semibold text-[11px] leading-snug truncate max-w-[100px]" style={{ color: textMain }}>{site.road}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Location row */}
        <div className="flex items-start gap-3 px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={layerColor + "bb"}/>
            <circle cx="12" cy="9" r="2.5" fill="white"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[12px]" style={{ color: textMain }}>{site.province}, Cambodia</p>
            <button onClick={handleCopyCoords} className="font-mono text-[10px] mt-0.5 hover:underline text-left" style={{ color: textDim }}>
              {site.lat.toFixed(5)}, {site.lng.toFixed(5)}
            </button>
          </div>
          {site.coordVerified ? (
            <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
              style={{ color: "#34d399", backgroundColor: "#34d39912" }}>✓ GPS</span>
          ) : (
            <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
              style={{ color: "#fbbf24", backgroundColor: "#fbbf2412" }}>est.</span>
          )}
        </div>

        {/* Notes / description */}
        {site.notes && (
          <div className="flex items-start gap-3 px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-[12px] leading-relaxed" style={{ color: textMuted }}>{site.notes}</p>
          </div>
        )}

        {/* Utilities */}
        {site.utilities && (
          <div className="flex items-start gap-3 px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <p className="text-[12px] leading-relaxed" style={{ color: textMuted }}>{site.utilities}</p>
          </div>
        )}

        {/* EIP 4-pillar score */}
        {(site.score !== undefined || hasEip) && (
          <div className="px-4 py-4" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: textDim }}>EIP Suitability Score</p>
              <div className="flex items-baseline gap-1">
                {site.eip_tier && (
                  <span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded mr-1"
                    style={{
                      color: site.eip_tier === "gold" ? "#fbbf24" : site.eip_tier === "silver" ? "#94a3b8" : "#f97316",
                      backgroundColor: site.eip_tier === "gold" ? "#fbbf2415" : site.eip_tier === "silver" ? "#94a3b815" : "#f9731615",
                    }}>
                    {site.eip_tier}
                  </span>
                )}
                <span className="text-[22px] font-extrabold leading-none" style={{ color: scoreColor }}>{site.score ?? "—"}</span>
                <span className="font-mono text-[9px]" style={{ color: textDim }}>/100</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" }}>
              <div className="h-full rounded-full" style={{ width: `${site.score ?? 0}%`, backgroundColor: scoreColor }} />
            </div>
            {hasEip && (
              <div className="space-y-2">
                {eipPillars.map((p) => p.value != null ? (
                  <div key={p.label} className="flex items-center gap-2">
                    <span className="font-mono text-[8px] w-[76px] shrink-0" style={{ color: textDim }}>{p.label}</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(p.value / 25) * 100}%`, backgroundColor: p.color }} />
                    </div>
                    <span className="font-mono text-[9px] w-5 text-right shrink-0" style={{ color: p.color }}>{p.value}</span>
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        )}

        {/* Target industries */}
        {!!site.targetIndustries?.length && (
          <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2.5" style={{ color: textDim }}>Target Industries</p>
            <div className="flex flex-wrap gap-1.5">
              {site.targetIndustries.map((ind) => (
                <span key={ind}
                  className="px-2.5 py-1 text-[11px] rounded-full border"
                  style={{ backgroundColor: `${layerColor}10`, borderColor: `${layerColor}40`, color: layerColor }}>
                  {ind}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Strengths + Constraints */}
        {(!!site.strengths?.length || !!site.constraints?.length) && (
          <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            {!!site.strengths?.length && (
              <>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: textDim }}>Strengths</p>
                <ul className="space-y-2 mb-3">
                  {site.strengths.map((s) => (
                    <li key={s} className="flex items-start gap-2.5 text-[12px] leading-snug" style={{ color: textMuted }}>
                      <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] mt-0.5" style={{ backgroundColor: "#34d39918", color: "#34d399" }}>✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!!site.constraints?.length && (
              <>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: textDim }}>Constraints</p>
                <ul className="space-y-2">
                  {site.constraints.map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-[12px] leading-snug" style={{ color: textMuted }}>
                      <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] mt-0.5" style={{ backgroundColor: "#f43f5e18", color: "#f43f5e" }}>!</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* GentryLab Advisory */}
        {site.recommendation && (
          <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}`, backgroundColor: isDark ? "#ff510009" : "#ff510005" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px]" style={{ color: "#ff5100" }}>◈</span>
              <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "#ff5100" }}>GentryLab Advisory</p>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: textMuted }}>{site.recommendation}</p>
          </div>
        )}

        {/* Latest news */}
        {relatedNews.length > 0 && (
          <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2.5" style={{ color: textDim }}>
              Latest News · {site.province}
            </p>
            <div className="space-y-2">
              {relatedNews.map((n) => (
                <a key={n.id} href={n.url !== "#" ? n.url : undefined}
                  target="_blank" rel="noopener noreferrer"
                  className="flex gap-3 py-2 transition hover:opacity-80">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider mb-1 rounded-full"
                      style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>
                      {n.sector}
                    </span>
                    <p className="text-[12px] leading-snug" style={{ color: textMain }}>{n.headline}</p>
                    <p className="font-mono text-[10px] mt-1" style={{ color: textDim }}>{n.source} · {n.date}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1.5" strokeLinecap="round" className="shrink-0 mt-4">
                    <path d="M7 17L17 7M17 7H7M17 7v10"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Related research */}
        {relatedResearch.length > 0 && (
          <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2.5" style={{ color: textDim }}>
              Related Research
            </p>
            <div className="space-y-2">
              {relatedResearch.map((r) => (
                <div key={r.id} className="flex gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider mb-1 rounded-full"
                      style={{ backgroundColor: "#818cf818", color: "#818cf8" }}>
                      {r.category}
                    </span>
                    <p className="text-[12px] leading-snug" style={{ color: textMain }}>{r.title}</p>
                    <p className="font-mono text-[10px] mt-1" style={{ color: textDim }}>{r.pages} pages</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer footer */}
        <div className="px-4 py-3">
          <p className="font-mono text-[9px]" style={{ color: textDim }}>{t("map.disclaimer")}</p>
        </div>
      </div>
    </aside>
  );
}

/* ── News Panel ─────────────────────────────────────────── */
function NewsPanel({
  province, items, onClose,
}: {
  province: string;
  items: NewsItem[];
  onClose: () => void;
}) {
  const SECTOR_COLOR: Record<string, string> = {
    Infrastructure: "#0ea5e9",
    Energy:         "#a855f7",
    Automotive:     "#f97316",
    Garment:        "#ec4899",
    "Data Center":  "#818cf8",
    Warehousing:    "#eab308",
    Policy:         "#94a3b8",
  };

  return (
    <aside className="absolute top-4 right-4 z-[400] w-[340px] max-w-[calc(100vw-2rem)] bg-[#0d0d0e] backdrop-blur border border-white/12 text-white flex flex-col max-h-[calc(100vh-5rem)] overflow-hidden shadow-2xl">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10"
        style={{ background: "linear-gradient(135deg, #f59e0b18 0%, #0d0d0e 75%)" }}>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/50 mb-0.5">
            Province Intelligence
          </p>
          <h3 className="font-extrabold text-[14px] uppercase tracking-tight text-white">{province}</h3>
          <p className="font-mono text-[10px] mt-0.5" style={{ color: "#f59e0b" }}>
            {items.length} news item{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition rounded-sm shrink-0">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M1 1l8 8M9 1L1 9"/>
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {items
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((n) => (
            <a
              key={n.id}
              href={n.url !== "#" ? n.url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3.5 border-b border-white/6 hover:bg-white/4 transition group"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider rounded-sm"
                  style={{
                    backgroundColor: `${SECTOR_COLOR[n.sector] ?? "#94a3b8"}22`,
                    color: SECTOR_COLOR[n.sector] ?? "#94a3b8",
                  }}>
                  {n.sector}
                </span>
                <span className="font-mono text-[9px] text-white/30 ml-auto">{n.date}</span>
              </div>
              <p className="text-[12px] font-semibold text-white/90 leading-snug mb-1.5 group-hover:text-white transition">
                {n.headline}
              </p>
              <p className="text-[10.5px] text-white/55 leading-relaxed mb-2">{n.summary}</p>
              <p className="font-mono text-[9px] text-white/30">{n.source}</p>
            </a>
          ))}
        <div className="px-4 py-2.5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/20">
            News sourced automatically · verify before use
          </p>
        </div>
      </div>
    </aside>
  );
}

/* ── Project Inspector ──────────────────────────────────── */
function ProjectInspector({
  project, onClose,
}: {
  project: TrackedProject;
  onClose: () => void;
}) {
  const statusColor = STATUS_COLOR[project.status] ?? "#94a3b8";
  const mapsUrl = project.maps_url ?? (project.lat
    ? `https://www.google.com/maps/search/?api=1&query=${project.lat},${project.lng}`
    : undefined);

  return (
    <aside className="absolute top-4 right-4 z-[400] w-[340px] max-w-[calc(100vw-2rem)] bg-[#0d0d0e] backdrop-blur border border-white/12 text-white flex flex-col max-h-[calc(100vh-5rem)] overflow-hidden shadow-2xl">
      <div className="shrink-0 border-b border-white/10"
        style={{ background: "linear-gradient(135deg, #818cf818 0%, #0d0d0e 75%)" }}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">
              Tracked Project
            </span>
            <span className="font-mono text-[9px] text-white/25">·</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: "#818cf8" }}>
              {project.sector}
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
          <h3 className="font-extrabold text-[15px] uppercase tracking-tight leading-tight text-white">{project.name}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
            <span className="font-mono text-[10px]" style={{ color: statusColor }}>{project.status}</span>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        <div className="px-4 py-3 border-b border-white/8">
          <p className="text-[12px] text-white/75 leading-relaxed">{project.summary}</p>
        </div>
        <div className="border-b border-white/8">
          <p className="px-4 pt-3 pb-1.5 font-mono text-[9px] uppercase tracking-widest text-white/35">Details</p>
          <dl className="px-4 pb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[11px]">
            <Row k="Investor"  v={project.investor}  isDark />
            <Row k="Origin"    v={project.origin}    isDark />
            <Row k="Province"  v={project.province}  isDark />
            <Row k="Size"      v={project.size}       isDark />
          </dl>
        </div>
        {project.latest_news_headline && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-2">Latest Coverage</p>
            <a href={project.latest_news_url ?? "#"} target="_blank" rel="noopener noreferrer"
              className="block bg-white/4 hover:bg-white/7 transition px-3 py-2.5 rounded-sm">
              <p className="text-[11px] text-white/85 leading-snug">{project.latest_news_headline}</p>
            </a>
          </div>
        )}
        {mapsUrl && (
          <div className="px-4 py-3 border-b border-white/8">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full py-2.5 border border-white/15 hover:border-white/35 hover:bg-white/5 transition group">
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/70 group-hover:text-white transition">
                Open in Google Maps ↗
              </span>
            </a>
          </div>
        )}
        <div className="px-4 py-2.5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/20">
            Updated {project.updated}
          </p>
        </div>
      </div>
    </aside>
  );
}

function Row({ k, v, isDark }: { k: string; v: string; isDark: boolean }) {
  return (
    <>
      <dt className="font-mono text-[9px] uppercase tracking-widest pt-0.5"
        style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)" }}>{k}</dt>
      <dd className="text-[11px] leading-snug"
        style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)" }}>{v}</dd>
    </>
  );
}
