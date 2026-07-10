import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { GoogleMapsOverlay } from "@deck.gl/google-maps";
import { GeoJsonLayer, BitmapLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import { MapClouds } from "@/components/site/MapClouds";
import { useLang } from "@/lib/i18n";
import { resolveAdminUnits } from "@/lib/geoLookup";
import { useMapSites, useNews, useProjects, useResearch, useSiteImages } from "@/lib/data";
import {
  CORRIDORS,
  LAYER_META,
  NEWS,
  PROJECTS,
  RESEARCH,
  SITES,
  type Corridor,
  type LayerGroup,
  type MapSite,
  type NewsItem,
  type ResearchBrief,
  type SiteKind,
  type TrackedProject,
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

/* ── Area layers (boundaries & footprints) ──────────────── */
type AreaKey =
  | "provinces" | "districts" | "communes" | "sez_footprints"
  | "protected" | "elc" | "powergrid" | "mining"
  | "railway" | "road_network" | "main_road" | "other_road" | "ip_land";

interface AreaDef {
  label: string;
  color: string;
  url?: string;            // GeoJSON path (provinces/districts)
  derived?: "sez";         // built from sites, no URL
  fillOpacity: number;     // base fill opacity (multiplied by slider)
  strokeWeight: number;
  defaultOpacity: number;  // initial slider value 0..1
  hint: string;            // legend sub-text
  source?: string;         // attribution line shown in legend
  available?: boolean;     // false = data file not yet bundled (hidden from panel)
  pointRadius?: number;    // px radius for Point geometry layers
}

const AREA_LAYERS: Record<AreaKey, AreaDef> = {
  provinces: {
    label: "Provinces", color: "#8b9cb3", url: "/geo/provinces.json",
    fillOpacity: 0.05, strokeWeight: 1, defaultOpacity: 0.8,
    hint: "25 provincial boundaries (GADM)", source: "GADM 4.1", available: true,
  },
  districts: {
    label: "Districts", color: "#6b7a8f", url: "/geo/districts.json",
    fillOpacity: 0.03, strokeWeight: 0.5, defaultOpacity: 0.6,
    hint: "202 district boundaries (GADM)", source: "GADM 4.1", available: true,
  },
  communes: {
    label: "Communes", color: "#4e5e72", url: "/geo/communes.json",
    fillOpacity: 0.02, strokeWeight: 0.3, defaultOpacity: 0.5,
    hint: "~1,646 commune boundaries (GADM)", source: "GADM 4.1", available: true,
  },
  sez_footprints: {
    label: "SEZ Footprints", color: "#ff5100", url: "/data/cambodia_sez_polygons.geojson",
    fillOpacity: 0.18, strokeWeight: 1.5, defaultOpacity: 0.9,
    hint: "35 SEZ polygon boundaries (ODC 2020)", source: "Open Development Cambodia", available: true,
  },
  // ── ODC datasets — flip `available: true` once the GeoJSON is bundled ──
  protected: {
    label: "Protected Areas", color: "#34d399", url: "/data/cambodia_protected_areas.geojson",
    fillOpacity: 0.2, strokeWeight: 1.2, defaultOpacity: 0.85,
    hint: "62 NPA zones — wildlife sanctuaries, national parks, protected landscapes (ODC 2017)", source: "Open Development Cambodia", available: true,
  },
  elc: {
    label: "Land Concessions", color: "#f59e0b", url: "/geo/elc.json",
    fillOpacity: 0.14, strokeWeight: 1, defaultOpacity: 0.75,
    hint: "Economic land concessions (ELC)", source: "ODC / LICADHO", available: false,
  },
  powergrid: {
    label: "Power Grid", color: "#eab308", url: "/geo/powergrid.json",
    fillOpacity: 0, strokeWeight: 1.6, defaultOpacity: 0.9,
    hint: "Transmission lines", source: "ODC / OSM", available: false,
  },
  mining: {
    label: "Mining Concessions", color: "#a16207", url: "/geo/mining.json",
    fillOpacity: 0.14, strokeWeight: 1, defaultOpacity: 0.75,
    hint: "Mining license areas", source: "ODC", available: false,
  },
  railway: {
    label: "Railway", color: "#fbbf24", url: "/data/cambodia_railway.geojson",
    fillOpacity: 0, strokeWeight: 3, defaultOpacity: 0.9,
    hint: "46 national rail routes — 41 existing + 5 proposed (ODC)", source: "Open Development Cambodia", available: true,
  },
  road_network: {
    label: "Road Network", color: "#e2e8f0", url: "/data/cambodia_road_network.geojson",
    fillOpacity: 0, strokeWeight: 2.5, defaultOpacity: 0.85,
    hint: "Trunk & motorway arteries — 2,526 segments (OSM 2022)", source: "OpenStreetMap 2022", available: true,
  },
  main_road: {
    label: "Main Road", color: "#94a3b8", url: "/data/cambodia_main_road.geojson",
    fillOpacity: 0, strokeWeight: 1.5, defaultOpacity: 0.75,
    hint: "Primary & secondary roads — 3,477 segments (OSM 2022)", source: "OpenStreetMap 2022", available: true,
  },
  other_road: {
    label: "Other Road", color: "#475569", url: "/data/cambodia_other_road.geojson",
    fillOpacity: 0, strokeWeight: 1, defaultOpacity: 0.6,
    hint: "Tertiary roads — 3,515 segments (OSM 2022)", source: "OpenStreetMap 2022", available: true,
  },
  ip_land: {
    label: "Indigenous Communal Land", color: "#f97316", url: "/data/cambodia_ip_land.geojson",
    fillOpacity: 0.85, strokeWeight: 1.5, defaultOpacity: 0.9, pointRadius: 6,
    hint: "44 registered IP communal land titles — Mondulkiri, Ratanakiri, Kratie, Stung Treng (ODC 2019–2026)",
    source: "Open Development Cambodia", available: true,
  },
};

const ALL_AREAS = (Object.keys(AREA_LAYERS) as AreaKey[]).filter((k) => AREA_LAYERS[k].available);

/** Parse a free-text size like "120 ha" / "1,200 hectares" → hectares number */
function parseSizeHa(size?: string): number | null {
  if (!size) return null;
  const m = size.match(/([\d,]+(?:\.\d+)?)\s*(?:ha|hectare)/i);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

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
  // Use Maps JS SDK Geocoder (avoids CORS issues with REST endpoint)
  if (window.google?.maps) {
    return new Promise((resolve) => {
      new google.maps.Geocoder().geocode(
        { address: query + " Cambodia", region: "kh" },
        (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            resolve([loc.lat(), loc.lng()]);
          } else resolve(null);
        }
      );
    });
  }
  // Nominatim fallback (no API key environment)
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
function buildPinSvg(kind: string, color: string, isKey: boolean, selected = false) {
  // Extra padding around the pin so the SVG-internal shadow doesn't clip
  const pad   = selected ? 10 : 6;
  const pinW  = selected ? 42 : isKey ? 36 : 28;
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
    ${selected ? `<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="none" stroke="white" stroke-width="2.5" opacity="0.95"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="${color}" opacity="0.18"/>` : ""}
    <path d="${path}" fill="${color}" filter="url(#ps)"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="${selected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.18)"}" stroke-width="${selected ? 1.6 : 1}"/>
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

    return () => {
      polysRef.current.forEach((p) => p.setMap(null));
      polysRef.current = [];
    };
  }, [map, corridors]);

  return null;
}

function markerIcon(s: MapSite, selected: boolean) {
  const color = KIND_COLOR[s.kind] ?? LAYER_META[s.layer].color;
  const isKey = (s.score ?? 0) >= 85;
  const { svg, cx, pinH, pinW } = buildPinSvg(s.kind, color, isKey, selected);
  return {
    url:        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
    anchor:     new google.maps.Point(cx, pinH),
    scaledSize: new google.maps.Size(pinW, pinH),
  };
}

function SiteMarkerLayer({
  sites, selectedId, onSelect, onHover,
}: {
  sites: MapSite[];
  selectedId: string | null;
  onSelect: (s: MapSite) => void;
  onHover: (s: MapSite | null) => void;
}) {
  const map         = useMap();
  const markersRef  = useRef<Map<string, google.maps.Marker>>(new globalThis.Map());
  const siteByIdRef = useRef<Map<string, MapSite>>(new globalThis.Map());
  const pulseRef    = useRef<google.maps.Circle | null>(null);
  const animRef     = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  const onHoverRef  = useRef(onHover);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onHoverRef.current  = onHover;  }, [onHover]);

  // Build markers when the site list changes
  useEffect(() => {
    if (!map) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = new globalThis.Map();
    siteByIdRef.current = new globalThis.Map();

    sites.forEach((s) => {
      siteByIdRef.current.set(s.id, s);
      const marker = new google.maps.Marker({
        position: { lat: s.lat, lng: s.lng },
        map,
        title:   s.name,
        opacity: s.coordVerified ? 1 : 0.6,
        icon:    markerIcon(s, false),
      });
      marker.addListener("click", () => onSelectRef.current(s));
      marker.addListener("mouseover", () => onHoverRef.current(s));
      marker.addListener("mouseout",  () => onHoverRef.current(null));
      markersRef.current.set(s.id, marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = new globalThis.Map();
    };
  }, [map, sites]);

  // Highlight + pulse the selected marker
  useEffect(() => {
    if (!map) return;

    // Reset all to normal, enlarge the selected one
    markersRef.current.forEach((m, id) => {
      const s = siteByIdRef.current.get(id);
      if (!s) return;
      const sel = id === selectedId;
      m.setIcon(markerIcon(s, sel));
      m.setZIndex(sel ? 999 : undefined);
      m.setOpacity(sel ? 1 : s.coordVerified ? 1 : 0.6);
    });

    // Tear down any existing pulse
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    pulseRef.current?.setMap(null);
    pulseRef.current = null;

    const sel = selectedId ? siteByIdRef.current.get(selectedId) : null;
    if (!sel) return;

    const color = KIND_COLOR[sel.kind] ?? LAYER_META[sel.layer].color;
    const circle = new google.maps.Circle({
      map,
      center: { lat: sel.lat, lng: sel.lng },
      radius: 0,
      strokeColor: color, strokeOpacity: 0.6, strokeWeight: 2,
      fillColor: color, fillOpacity: 0.12, clickable: false, zIndex: 1,
    });
    pulseRef.current = circle;

    const MAX = 1200; // metres
    const start = performance.now();
    const tick = (t: number) => {
      const phase = ((t - start) % 1600) / 1600;     // 1.6s loop
      circle.setRadius(phase * MAX);
      circle.setOptions({ strokeOpacity: 0.6 * (1 - phase), fillOpacity: 0.12 * (1 - phase) });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      pulseRef.current?.setMap(null);
      pulseRef.current = null;
    };
  }, [map, selectedId]);

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
          "&LAYERS=FloodHazard100y&STYLES=&FORMAT=image/png&TRANSPARENT=true" +
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

/* ── Area layers (GADM boundaries + derived footprints) ──── */

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

type AreaHoverInfo = { props: Record<string, unknown>; layerId: string; x: number; y: number } | null;

/** Single deck.gl overlay — renders all GeoJSON boundary layers + coverage rasters via WebGL */
function DeckGlMapOverlay({ layers, onHover }: { layers: Layer[]; onHover?: (info: AreaHoverInfo) => void }) {
  const map = useMap();
  const overlayRef = useRef<GoogleMapsOverlay | null>(null);
  const onHoverRef = useRef(onHover);
  useEffect(() => { onHoverRef.current = onHover; }, [onHover]);

  useEffect(() => {
    if (!map) return;
    const overlay = new GoogleMapsOverlay({
      interleaved: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onHover: (info: any) => {
        if (info.object && info.layer?.id?.startsWith("area-")) {
          onHoverRef.current?.({ props: info.object.properties ?? {}, layerId: info.layer.id, x: info.x, y: info.y });
        } else {
          onHoverRef.current?.(null);
        }
      },
    });
    overlay.setMap(map as google.maps.Map);
    overlayRef.current = overlay;
    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    overlayRef.current?.setProps({ layers } as any);
  }, [layers]);

  return null;
}

/** SEZ footprint circles — radius derived from each SEZ's size in hectares */
function SezFootprintLayer({
  sites, opacity, onSelect,
}: {
  sites: MapSite[];
  opacity: number;
  onSelect: (s: MapSite) => void;
}) {
  const map = useMap();
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!map) return;
    const circles: google.maps.Circle[] = [];

    for (const s of sites) {
      if (s.kind !== "sez" && s.kind !== "park") continue;
      const ha = parseSizeHa(s.size);
      if (!ha || ha <= 0) continue;
      // area (m²) = ha × 10,000 ; radius = sqrt(area / π)
      const radius = Math.sqrt((ha * 10_000) / Math.PI);
      const circle = new google.maps.Circle({
        map,
        center:        { lat: s.lat, lng: s.lng },
        radius,
        fillColor:     "#ff5100",
        fillOpacity:   0.16 * opacity,
        strokeColor:   "#ff5100",
        strokeOpacity: 0.85 * opacity,
        strokeWeight:  1.4,
        clickable:     true,
        zIndex:        2,
      });
      circle.addListener("click", () => onSelectRef.current(s));
      circles.push(circle);
    }

    return () => { circles.forEach((c) => c.setMap(null)); };
  }, [map, sites, opacity]);

  return null;
}

/* ── Mobile coverage raster overlays (GroundOverlay) ─────── */
interface CoverageDef {
  key: string;
  label: string;
  color: string;
  url: string;
  bounds: { north: number; south: number; east: number; west: number };
}

const COVERAGE: CoverageDef[] = [
  { key: "cov_cellcard_4g", label: "Cellcard 4G", color: "#ffc400", url: "/geo/coverage/cov_cellcard_4g.png", bounds: { north: 14.60, south: 10.36, east: 107.65, west: 102.29 } },
  { key: "cov_metfone_4g",  label: "Metfone 4G",  color: "#ffd400", url: "/geo/coverage/cov_metfone_4g.png",  bounds: { north: 14.59, south: 10.29, east: 107.65, west: 102.32 } },
  { key: "cov_smart_4g",    label: "Smart 4G",    color: "#e0241b", url: "/geo/coverage/cov_smart_4g.png",    bounds: { north: 15.19, south: 9.51,  east: 108.45, west: 101.57 } },
];


/* ── Reference point coords (static — matches DB reference_points.name) ── */
const REF_COORDS: Record<string, { lat: number; lng: number }> = {
  // Airports
  "Techo International Airport":    { lat: 11.3589, lng: 104.9335 },
  "Siem Reap Angkor International": { lat: 13.3762, lng: 104.2201 },
  "Sihanoukville International":    { lat: 10.5797, lng: 103.6368 },
  "Battambang Airport":             { lat: 13.0956, lng: 103.2242 },
  // Ports
  "Phnom Penh Autonomous Port":     { lat: 11.5625, lng: 104.9311 },
  "Sihanoukville Autonomous Port":  { lat: 10.6167, lng: 103.5167 },
  "Koh Kong Port":                  { lat: 11.6236, lng: 102.9837 },
  // Borders — Cambodia/Vietnam
  "Prek Chak / Xa Xia":            { lat: 10.4280, lng: 104.4526 }, // Google Maps: Prek Chak International Border Check Point
  "Phnom Den / Tinh Bien":         { lat: 10.6027, lng: 104.9290 }, // Google Maps: Phnom Den Border Gate
  "Kaam Samnor / Vinh Xuong":      { lat: 10.9128, lng: 105.1787 }, // Google Maps: Cambodian checkpoint
  "Bavet / Moc Bai":               { lat: 11.0755, lng: 106.1715 }, // Google Maps: Bavet Border Check Point
  "Trapang Phlong / Xa Mat":       { lat: 11.6677, lng: 105.9813 }, // Google Maps: Trapang Phlong Border Check Point
  "Trapang Sre / Loc Ninh":        { lat: 11.9699, lng: 106.5415 }, // Google Maps: Trapaing Sre International Check Point
  "O'Yadav / Le Thanh":            { lat: 13.7682, lng: 107.4960 }, // Google Maps: Oyadav Customs and Excise Office
  // Cambodia/Thailand
  "Cham Yeam / Hat Lek":           { lat: 11.6506, lng: 102.9102 }, // Google Maps: Cham Yeam Border Check Point
  "Psar Pruhm / Ban Pakard":       { lat: 12.9277, lng: 102.4954 }, // Google Maps: Psar Pruhm border checkpoint
  "Poipet / Aranyaprathet":        { lat: 13.6612, lng: 102.5507 }, // Google Maps: Poipet Border Gate Police
  "O'Smach / Chong Jom":           { lat: 14.4341, lng: 103.6996 }, // Google Maps: Osmach Customs Check Point
  // Cambodia/Laos
  "Veun Kham / Don Kralor":        { lat: 13.9217, lng: 106.0305 }, // Google Maps: Trapang Kreal Border Check Point
};

// Translates DB shorthand values to REF_COORDS keys
const CONN_ALIAS: Record<string, string> = {
  "KTI": "Techo International Airport",
  "PNH": "Techo International Airport",
  "KOS": "Sihanoukville International",
  "SAI": "Siem Reap Angkor International",
  "REP": "Siem Reap Angkor International",
  "BBM": "Battambang Airport",
  "Phnom Penh Port":           "Phnom Penh Autonomous Port",
  "Sihanoukville Port (APSEZ)":"Sihanoukville Autonomous Port",
  "Sihanoukville Port":        "Sihanoukville Autonomous Port",
};
function resolveRef(name: string): string { return CONN_ALIAS[name] ?? name; }

const CONN_COLORS = {
  airport: "#1D9E75",
  port:    "#378ADD",
  border:  "#D85A30",
} as const;

/* Fetch road geometry from OSRM (free, no API key). Falls back to straight line. */
async function fetchRoadPath(
  from: { lat: number; lng: number },
  to:   { lat: number; lng: number },
): Promise<google.maps.LatLngLiteral[]> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    const coords = data.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (coords?.length) return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch { /* timeout or error — fall through */ }
  return [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }];
}

/* ── Connectivity route layer — animated dashed lines on site select ─── */
function ConnectivityRouteLayer({ site }: { site: MapSite }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const routes: { name: string; type: keyof typeof CONN_COLORS }[] = [
      { name: site.nearest_airport ?? "", type: "airport" },
      { name: site.nearest_port    ?? "", type: "port" },
      { name: site.nearest_border  ?? "", type: "border" },
    ].filter((r) => r.name && REF_COORDS[resolveRef(r.name)]);

    if (!routes.length) return;

    const polys:   google.maps.Polyline[] = [];
    const labels:  google.maps.Marker[]   = [];
    const timers:  ReturnType<typeof setInterval>[] = [];
    let cancelled = false;

    const dashSymbol = (color: string): google.maps.Symbol => ({
      path: "M 0,-1 0,1",
      strokeOpacity: 1,
      strokeColor: color,
      scale: 3,
    });

    const addRoute = (
      path:  google.maps.LatLngLiteral[],
      color: string,
      targetName: string,
      targetCoord: { lat: number; lng: number },
      type: keyof typeof CONN_COLORS,
    ) => {
      if (cancelled) return;

      const poly = new google.maps.Polyline({
        path,
        map,
        strokeOpacity: 0,
        strokeWeight: 0,
        zIndex: 50,
        icons: [{
          icon: dashSymbol(color),
          offset: "0",
          repeat: "16px",
        }],
      });
      polys.push(poly);

      // Animate dash offset
      let offset = 0;
      const timer = setInterval(() => {
        offset = (offset + 1) % 100;
        const icons = poly.get("icons") as google.maps.IconSequence[];
        icons[0].offset = offset + "%";
        poly.set("icons", icons);
      }, 25);
      timers.push(timer);

      // Endpoint label marker
      const typeIcon = type === "airport" ? "✈" : type === "port" ? "⚓" : "🛂";
      const shortName = targetName.length > 22 ? targetName.slice(0, 21) + "…" : targetName;
      const labelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="28">
        <rect x="0" y="0" width="160" height="28" rx="4" fill="${color}" fill-opacity="0.92"/>
        <text x="8" y="19" font-size="13" fill="white" font-family="sans-serif" font-weight="600">${typeIcon} ${shortName}</text>
      </svg>`;
      const label = new google.maps.Marker({
        position: targetCoord,
        map,
        icon: {
          url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(labelSvg),
          anchor: new google.maps.Point(0, 14),
          scaledSize: new google.maps.Size(160, 28),
        },
        zIndex: 51,
        clickable: false,
      });
      labels.push(label);
    };

    // Draw straight lines immediately, replace with road routes async
    for (const r of routes) {
      const resolvedName = resolveRef(r.name);
      const to = REF_COORDS[resolvedName];
      const color = CONN_COLORS[r.type];
      const from = { lat: site.lat, lng: site.lng };
      const straight = [from, to];

      addRoute(straight, color, resolvedName, to, r.type);

      // Fetch road route and replace path
      const idx = polys.length - 1;
      fetchRoadPath(from, to).then((roadPath) => {
        if (!cancelled && polys[idx]) polys[idx].setPath(roadPath);
      });
    }

    return () => {
      cancelled = true;
      timers.forEach((t) => clearInterval(t));
      polys.forEach((p)  => p.setMap(null));
      labels.forEach((l) => l.setMap(null));
    };
  }, [map, site.id]);

  return null;
}

/* ── Province centroids (for news geo-tagging) ───────────── */
const PROVINCE_CENTROIDS: Record<string, [number, number]> = {
  "Phnom Penh":         [11.5564, 104.9282],
  "Kandal":             [11.2833, 104.9500],
  "Kampong Speu":       [11.4500, 104.5200],
  "Sihanoukville":      [10.6167, 103.5167],
  "Preah Sihanouk":     [10.6167, 103.5167],
  "Svay Rieng":         [11.0833, 105.8000],
  "Kampong Cham":       [11.9931, 105.4636],
  "Kampot":             [10.5933, 104.1667],
  "Siem Reap":          [13.3671, 103.8448],
  "Battambang":         [13.0957, 103.2022],
  "Takeo":              [10.9900, 104.7986],
  "Prey Veng":          [11.4833, 105.3167],
  "Pursat":             [12.5333, 103.9167],
  "Kampong Thom":       [12.7111, 104.8889],
  "Kampong Chhnang":    [12.2500, 104.6667],
  "Kratie":             [12.4883, 106.0183],
  "Stung Treng":        [13.5239, 105.9702],
  "Ratanakiri":         [13.7336, 107.0053],
  "Mondulkiri":         [12.4535, 107.1878],
  "Koh Kong":           [11.6153, 102.9836],
  "Kep":                [10.4833, 104.3167],
  "Pailin":             [12.8488, 102.6097],
  "Oddar Meanchey":     [14.1803, 103.5197],
  "Banteay Meanchey":   [13.7538, 102.9892],
  "Preah Vihear":       [13.8054, 104.9753],
  "Nationwide":         [12.5, 104.9],
};

/* ── News marker layer (province-grouped, amber newspaper pin) ── */
function NewsMarkerLayer({
  news, onProvinceClick,
}: {
  news: NewsItem[];
  onProvinceClick: (province: string, items: NewsItem[]) => void;
}) {
  const map = useMap();
  const onClickRef = useRef(onProvinceClick);
  useEffect(() => { onClickRef.current = onProvinceClick; }, [onProvinceClick]);

  useEffect(() => {
    if (!map || !news.length) return;

    // Group by province
    const byProvince = new globalThis.Map<string, NewsItem[]>();
    for (const item of news) {
      const prov = item.province ?? "Nationwide";
      if (!byProvince.has(prov)) byProvince.set(prov, []);
      byProvince.get(prov)!.push(item);
    }

    const markers: google.maps.Marker[] = [];

    byProvince.forEach((items, province) => {
      const coords = PROVINCE_CENTROIDS[province] ?? PROVINCE_CENTROIDS["Nationwide"];
      const count = items.length;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="17" fill="#f59e0b" fill-opacity="0.92" stroke="white" stroke-width="1.5"/>
        <rect x="10" y="10" width="11" height="14" rx="1" fill="white" fill-opacity="0.9"/>
        <rect x="10" y="10" width="11" height="3" rx="1" fill="white"/>
        <line x1="12" y1="16" x2="19" y2="16" stroke="#f59e0b" stroke-width="1.2"/>
        <line x1="12" y1="18.5" x2="19" y2="18.5" stroke="#f59e0b" stroke-width="1.2"/>
        <line x1="12" y1="21" x2="17" y2="21" stroke="#f59e0b" stroke-width="1.2"/>
        ${count > 1 ? `<circle cx="25" cy="11" r="7" fill="#dc2626"/><text x="25" y="15" text-anchor="middle" font-size="8" fill="white" font-family="sans-serif" font-weight="bold">${count}</text>` : ""}
      </svg>`;

      const marker = new google.maps.Marker({
        position: { lat: coords[0], lng: coords[1] },
        map,
        title: `${province}: ${count} news item${count > 1 ? "s" : ""}`,
        icon: {
          url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
          anchor: new google.maps.Point(18, 18),
          scaledSize: new google.maps.Size(36, 36),
        },
        zIndex: 300,
      });
      marker.addListener("click", () => onClickRef.current(province, items));
      markers.push(marker);
    });

    return () => { markers.forEach((m) => m.setMap(null)); };
  }, [map, news]);

  return null;
}

/* ── Project marker layer (diamond/flag icon, indigo) ─────── */
function ProjectMarkerLayer({
  projects, onSelect,
}: {
  projects: TrackedProject[];
  onSelect: (p: TrackedProject) => void;
}) {
  const map = useMap();
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!map) return;
    const markers: google.maps.Marker[] = [];

    for (const p of projects) {
      if (p.lat == null || p.lng == null) continue;
      const statusColor = p.status === "Operational" ? "#34d399" : p.status === "Under Construction" ? "#fbbf24" : "#818cf8";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <polygon points="16,3 29,16 16,29 3,16" fill="${statusColor}" fill-opacity="0.9" stroke="white" stroke-width="1.5"/>
        <text x="16" y="20" text-anchor="middle" font-size="11" fill="white" font-family="sans-serif" font-weight="bold">P</text>
      </svg>`;

      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: p.name,
        icon: {
          url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
          anchor: new google.maps.Point(16, 16),
          scaledSize: new google.maps.Size(32, 32),
        },
        zIndex: 250,
      });
      marker.addListener("click", () => onSelectRef.current(p));
      markers.push(marker);
    }

    return () => { markers.forEach((m) => m.setMap(null)); };
  }, [map, projects]);

  return null;
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
    <APIProvider apiKey={gKey ?? ""} libraries={["places"]}>
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
  const { data: allNews = NEWS }         = useNews();
  const { data: allProjects = PROJECTS } = useProjects();
  const [active, setActive] = useState<Set<LayerGroup>>(new Set(["investment", "corridors"] as LayerGroup[]));
  const [selected, setSelected] = useState<MapSite | null>(null);
  const [query, setQuery]   = useState("");
  const [subKinds, setSubKinds] = useState<Partial<Record<LayerGroup, Set<SiteKind>>>>({ investment: new Set(["sez", "park"] as SiteKind[]) });
  const [panelOpen, setPanelOpen] = useState(false);
  const [basemap, setBasemap]     = useState<BasemapKey>(themeBasemap);
  const [floodVisible, setFloodVisible] = useState(true);
  const [areaActive, setAreaActive] = useState<Set<AreaKey>>(new Set(["protected", "districts", "communes", "sez_footprints", "railway", "road_network", "main_road", "other_road"] as AreaKey[]));
  const [areaOpacity, setAreaOpacity] = useState<Record<AreaKey, number>>(
    () => Object.fromEntries(ALL_AREAS.map((k) => [k, AREA_LAYERS[k].defaultOpacity])) as Record<AreaKey, number>
  );
  const [covActive, setCovActive] = useState<Set<string>>(new Set());
  const [covOpacity, setCovOpacity] = useState(0.7);
  const [newsVisible, setNewsVisible] = useState(false);
  const [projectsVisible, setProjectsVisible] = useState(false);
  const [newsPanel, setNewsPanel] = useState<{ province: string; items: NewsItem[] } | null>(null);
  const [selectedProject, setSelectedProject] = useState<TrackedProject | null>(null);
  const [hoveredSite, setHoveredSite] = useState<MapSite | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [areaHover, setAreaHover] = useState<AreaHoverInfo>(null);
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

  /* Location callout (empty-map click, Google Maps style) */
  const [locCallout, setLocCallout] = useState<{
    lat: number; lng: number;
    address: string | null;
    plusCode: string | null;
    province?: string;
    district?: string;
    commune?: string;
    loading: boolean;
  } | null>(null);

  /* Shared reverse-geocode → populates the location callout for any
     pinned point (map click, search result, or autocomplete pick) so
     "Use this location" works the same way from all three entry points.
     Also resolves Province/District/Commune via the GADM boundary files
     (same "Area Data" layers) so reports can carry the exact admin unit,
     not just a fuzzy Google address. */
  const showCalloutAt = useCallback(async (lat: number, lng: number) => {
    setSelected(null);
    setLocCallout({ lat, lng, address: null, plusCode: null, loading: true });
    try {
      const [geoRes, admin] = await Promise.all([
        fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${gKey}`).then((r) => r.json()),
        resolveAdminUnits(lat, lng),
      ]);
      /* Prefer a named locality over Plus Code */
      const named = geoRes.results?.find((x: { types: string[] }) =>
        x.types?.some((t: string) => ["locality","sublocality","neighborhood","natural_feature","establishment","point_of_interest"].includes(t))
      );
      const plusCode = geoRes.plus_code?.global_code ?? null;
      const address = named?.address_components?.[0]?.long_name ?? geoRes.results?.[0]?.formatted_address?.split(",")[0] ?? null;
      setLocCallout({ lat, lng, address, plusCode, province: admin.province, district: admin.district, commune: admin.commune, loading: false });
    } catch {
      setLocCallout((c) => c ? { ...c, loading: false } : null);
    }
  }, [gKey]);

  /* Fetch Places Autocomplete suggestions via Maps JS SDK (no CORS issue) */
  const fetchSuggestions = useCallback((input: string) => {
    if (input.length < 2) { setSuggestions([]); return; }
    if (!window.google?.maps?.places) { setSuggestions([]); return; }
    const svc = new google.maps.places.AutocompleteService();
    svc.getPlacePredictions(
      { input, componentRestrictions: { country: "kh" } },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          setSuggestions([]); return;
        }
        setSuggestions(predictions.slice(0, 5).map((p) => ({
          placeId:   p.place_id,
          main:      p.structured_formatting?.main_text ?? p.description,
          secondary: p.structured_formatting?.secondary_text ?? "",
        })));
      }
    );
  }, []);

  /* Pick a suggestion — resolve coords via Geocoder (no CORS, no fake div) */
  const pickSuggestion = useCallback((s: { placeId: string; main: string; secondary: string }) => {
    setLocationInput(s.main);
    setSuggestions([]);
    setShowSuggestions(false);
    setLocSearching(true);
    if (!window.google?.maps) { setLocSearching(false); return; }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ placeId: s.placeId }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        setPinMarker({ lat: loc.lat(), lng: loc.lng() });
        setPinTarget({ lat: loc.lat(), lng: loc.lng(), zoom: 15 });
        showCalloutAt(loc.lat(), loc.lng());
      }
      setLocSearching(false);
    });
  }, [showCalloutAt]);

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

  const handleMapClick = useCallback((e: { detail: { latLng: { lat: number; lng: number } | null } }) => {
    const ll = e.detail.latLng;
    if (!ll) return;
    showCalloutAt(ll.lat, ll.lng);
  }, [showCalloutAt]);

  const visible = useMemo(() => {
    if (previewMode) return [];
    const q = query.trim().toLowerCase();
    return sites.filter((s) => {
      if (!active.has(s.layer)) return false;
      const subKind = subKinds[s.layer];
      if (subKind && subKind.size > 0 && !subKind.has(s.kind as SiteKind)) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.province.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [active, query, subKinds, previewMode, sites]);

  // isDark must be declared BEFORE the deckLayers useMemo (it's in the dep array + callback)
  const bm = BASEMAPS[basemap];
  const isDark = bm.isDark;

  // Corridors layer is now a folder — no standalone corridor lines
  const visibleCorridors: typeof CORRIDORS = [];

  // Road layers use light colors on dark basemap; flip to dark on light basemap
  const ROAD_LIGHT_MODE_COLORS: Partial<Record<AreaKey, string>> = {
    road_network: "#1e293b",
    main_road:    "#475569",
    other_road:   "#64748b",
  };

  const deckLayers = useMemo((): Layer[] => {
    const layers: Layer[] = [];

    // Zone-category fill colours for Protected Areas (matches ODC legend)
    const ZONE_COLORS: Record<string, [number, number, number]> = {
      "Core zone":           [55,  86,  35],
      "Conservation zone":   [169, 209, 142],
      "Sustainable use zone":[214, 232, 122],
      "Community zone":      [244, 185, 129],
    };
    const PROTECTED_STROKE: [number, number, number] = [52, 211, 153]; // #34d399

    // GeoJSON boundary layers (provinces, districts, ODC datasets)
    for (const k of ALL_AREAS) {
      const def = AREA_LAYERS[k];
      if (!def.url || !areaActive.has(k)) continue;
      // Road-type layers are children of the Corridors folder — hide when Corridors is OFF
      const ROAD_KEYS: AreaKey[] = ["railway", "road_network", "main_road", "other_road"];
      if (ROAD_KEYS.includes(k) && !active.has("corridors")) continue;
      const effectiveColor = (!isDark && ROAD_LIGHT_MODE_COLORS[k]) ? ROAD_LIGHT_MODE_COLORS[k]! : def.color;
      const [r, g, b] = hexToRgb(effectiveColor);
      const op = areaOpacity[k] ?? def.defaultOpacity;

      if (k === "protected") {
        // Per-feature fill colour based on zone_category
        layers.push(
          new GeoJsonLayer({
            id: `area-${k}`,
            data: def.url,
            filled: true,
            stroked: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            getFillColor: (f: any) => {
              const zc = f?.properties?.zone_category as string | undefined;
              const [zr, zg, zb] = ZONE_COLORS[zc ?? ""] ?? [52, 211, 153];
              return [zr, zg, zb, Math.round(0.55 * op * 255)];
            },
            getLineColor: PROTECTED_STROKE.concat([Math.round(0.85 * op * 255)]) as [number,number,number,number],
            getLineWidth: def.strokeWeight,
            lineWidthMinPixels: def.strokeWeight,
            lineWidthUnits: "pixels" as const,
            pickable: true,
            autoHighlight: true,
            highlightColor: [52, 211, 153, 45],
            updateTriggers: { getFillColor: [op] },
          }),
        );
        continue;
      }

      layers.push(
        new GeoJsonLayer({
          id: `area-${k}`,
          data: def.url,
          filled: true,
          stroked: true,
          getFillColor: [r, g, b, Math.round(def.fillOpacity * op * 255)],
          getLineColor: [r, g, b, Math.round(0.9 * op * 255)],
          getLineWidth: def.strokeWeight,
          lineWidthMinPixels: def.strokeWeight,
          lineWidthUnits: "pixels" as const,
          ...(def.pointRadius != null && {
            getPointRadius: def.pointRadius,
            pointRadiusUnits: "pixels" as const,
            pointRadiusMinPixels: 3,
          }),
          pickable: true,
          autoHighlight: true,
          highlightColor: [r, g, b, 45],
        }),
      );
    }

    // Mobile 4G coverage raster overlays
    for (const c of COVERAGE) {
      if (!covActive.has(c.key)) continue;
      layers.push(
        new BitmapLayer({
          id: `cov-${c.key}`,
          image: c.url,
          bounds: [c.bounds.west, c.bounds.south, c.bounds.east, c.bounds.north],
          opacity: covOpacity,
          transparentColor: [0, 0, 0, 0],
        }),
      );
    }

    return layers;
  }, [areaActive, areaOpacity, covActive, covOpacity, isDark, active]);

  const toggle = (g: LayerGroup) =>
    setActive((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });

  const toggleSubKind = (layer: LayerGroup, kind: SiteKind | "all") =>
    setSubKinds((prev) => {
      const cur = new Set(prev[layer] ?? []);
      if (kind === "all") return { ...prev, [layer]: new Set<SiteKind>() };
      if (cur.has(kind as SiteKind)) { cur.delete(kind as SiteKind); }
      else { cur.add(kind as SiteKind); }
      return { ...prev, [layer]: cur };
    });

  const toggleArea = (k: AreaKey) =>
    setAreaActive((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const setOpacity = (k: AreaKey, v: number) =>
    setAreaOpacity((prev) => ({ ...prev, [k]: v }));

  const toggleCov = (k: string) =>
    setCovActive((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

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
      showCalloutAt(coords[0], coords[1]);
      setLocError("");
    }
    setLocSearching(false);
  };

  const handleSelect = useCallback((s: MapSite) => {
    setSelected(s);
    setLocCallout(null);
    setPanelOpen(false);
    setNewsPanel(null);
    setSelectedProject(null);
  }, []);

  /* Deep link: /map?site=<id> opens & flies to that location (shared links) */
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current || !sites.length) return;
    const id = new URLSearchParams(window.location.search).get("site");
    if (!id) { deepLinkDone.current = true; return; }
    const target = sites.find((s) => s.id === id);
    if (target) {
      deepLinkDone.current = true;
      setSelected(target);
      setPinTarget({ lat: target.lat, lng: target.lng, zoom: 13 });
    }
  }, [sites]);

  /* Pin-for-advisor mode: /map?pin=1 — arrived here from the AI Advisor's
     "Pin from map" button. Shows a hint banner and routes "Use this
     location" back to /tools/advisor with lat/lng/address + resume flag
     so the advisor can restore the exact brief + field that was pinning. */
  const pinMode = useMemo(() => new URLSearchParams(window.location.search).get("pin") === "1", []);

  const handleUseLocation = useCallback(() => {
    if (!locCallout) return;
    const params = new URLSearchParams({
      lat: String(locCallout.lat),
      lng: String(locCallout.lng),
      address: locCallout.address ?? "",
      ...(locCallout.province ? { province: locCallout.province } : {}),
      ...(locCallout.district ? { district: locCallout.district } : {}),
      ...(locCallout.commune  ? { commune:  locCallout.commune  } : {}),
      ...(pinMode ? { resume: "1" } : {}),
    });
    window.location.href = `/tools/advisor?${params.toString()}`;
  }, [locCallout, pinMode]);

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

  // Panel palette — adapts to basemap light/dark mode
  const pc = {
    bg:        isDark ? "rgba(0,0,0,0.95)"      : "rgba(255,255,255,0.97)",
    border:    isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
    divider:   isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    label:     isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)",
    textOn:    isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)",
    textOff:   isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)",
    textMid:   isDark ? "rgba(255,255,255,0.5)"  : "rgba(0,0,0,0.5)",
    inactiveBorder: isDark ? "rgba(255,255,255,0.1)"  : "rgba(0,0,0,0.12)",
    inactiveText:   isDark ? "rgba(255,255,255,0.3)"  : "rgba(0,0,0,0.35)",
    hover:     isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
  };

  /* ── Full map ───────────────────────────────────────────── */
  return (
    <div className="relative h-full min-h-0 w-full bg-black" ref={wrapperRef}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      {/* Map canvas */}
      <div className="absolute inset-0">
        <APIProvider apiKey={gKey ?? ""} libraries={["places"]}>
          <Map
            style={{ height: "100%", width: "100%" }}
            defaultCenter={{ lat: 12.2, lng: 104.9 }}
            defaultZoom={7}
            minZoom={6}
            maxZoom={17}
            mapTypeId={bm.mapTypeId}
            styles={bm.styles}
            disableDefaultUI
            scaleControl
            gestureHandling="greedy"
            backgroundColor="#0d1117"
            onClick={handleMapClick}
          >
            <FlyController target={pinTarget} />
            <ZoomLabelController />
            <ZoomClassController wrapperRef={wrapperRef} />
            <MapClouds />

            {(floodVisible || bm.floodOverlay) && <FloodLayer />}

            {/* deck.gl overlay — only mount when layers exist to avoid blank WebGL canvas */}
            {deckLayers.length > 0 && <DeckGlMapOverlay layers={deckLayers} onHover={setAreaHover} />}

            <CorridorLayer corridors={visibleCorridors} />
            <SiteMarkerLayer sites={visible} selectedId={selected?.id ?? null} onSelect={handleSelect} onHover={setHoveredSite} />
            {selected && <ConnectivityRouteLayer site={selected} />}
            {newsVisible && (
              <NewsMarkerLayer
                news={allNews}
                onProvinceClick={(province, items) => {
                  setNewsPanel({ province, items });
                  setSelected(null);
                  setSelectedProject(null);
                  setLocCallout(null);
                }}
              />
            )}
            {projectsVisible && (
              <ProjectMarkerLayer
                projects={allProjects}
                onSelect={(p) => {
                  setSelectedProject(p);
                  setSelected(null);
                  setNewsPanel(null);
                  setLocCallout(null);
                }}
              />
            )}
            {pinMarker && <PinMarkerLayer position={pinMarker} />}
          </Map>
        </APIProvider>
      </div>

      {/* ── Pin-for-Advisor mode hint ──────────────────────── */}
      {pinMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl"
          style={{ backgroundColor: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,81,0,0.4)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#ff5100" }} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/80 whitespace-nowrap">
            Search or click the map to pin your project location
          </span>
        </div>
      )}

      {/* ── Search bar (beside LAYERS button, top-left) ───── */}
      <div ref={searchWrapRef} className="absolute top-4 z-[600]" style={{ left: "168px", right: "16px", maxWidth: "320px" }}>
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
            className="flex-1 px-3 py-2 text-[11px] text-white bg-transparent placeholder:text-white/30 focus:outline-none"
          />
          {locationInput && (
            <button type="button"
              onClick={() => { setLocationInput(""); setPinMarker(null); setLocError(""); setSuggestions([]); setShowSuggestions(false); }}
              className="text-white/30 hover:text-white/80 flex items-center justify-center w-11 h-11 shrink-0 text-base transition">✕</button>
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
        <div className="absolute top-14 left-4 z-[500] w-[220px] backdrop-blur shadow-2xl rounded-sm overflow-y-auto max-h-[calc(100vh-220px)] overscroll-contain"
          style={{ backgroundColor: pc.bg, border: `1px solid ${pc.border}` }}>
          <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${pc.divider}` }}>
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: pc.label }}>Map Layers</span>
            <button onClick={() => setPanelOpen(false)} className="text-xs transition hover:opacity-100" style={{ color: pc.label }}>✕</button>
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
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 transition rounded-sm text-left"
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = pc.hover)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                      style={{ backgroundColor: meta.color, opacity: on ? 1 : 0.25 }} />
                    <span className="font-mono text-[10px] uppercase tracking-wider flex-1 transition-opacity"
                      style={{ color: on ? pc.textOn : pc.textOff }}>
                      {meta.label}
                    </span>
                    {cnt > 0 && (
                      <span className="font-mono text-[9px]" style={{ color: pc.textOff }}>{cnt}</span>
                    )}
                    <span className="font-mono text-[8px] transition" style={{ color: on ? pc.textMid : pc.textOff }}>
                      {on ? "ON" : "OFF"}
                    </span>
                  </button>
                  {on && subkinds && (
                    <div className="pl-5 pb-1 flex flex-wrap gap-1">
                      {subkinds.map((sk) => (
                        <button
                          key={sk.value}
                          onClick={() => toggleSubKind(layer, sk.value)}
                          className="px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider border transition"
                          style={(() => {
                            const sel = subKinds[layer];
                            const isAll = sk.value === "all";
                            const isActive = isAll ? (!sel || sel.size === 0) : (sel?.has(sk.value as SiteKind) ?? false);
                            return {
                              borderColor: isActive ? meta.color : pc.inactiveBorder,
                              color: isActive ? meta.color : pc.inactiveText,
                              backgroundColor: isActive ? `${meta.color}15` : "transparent",
                            };
                          })()}
                        >
                          {sk.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Indigenous Communal Land — nested under Risk Zones */}
                  {layer === "risk" && (() => {
                    const def = AREA_LAYERS["ip_land"];
                    const aon = areaActive.has("ip_land");
                    return (
                      <div className="pl-5">
                        <button
                          onClick={() => toggleArea("ip_land")}
                          className="w-full flex items-center gap-2 px-2 py-1 transition rounded-sm text-left"
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = pc.hover)}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0 border transition-opacity"
                            style={{ backgroundColor: `${def.color}55`, borderColor: def.color, opacity: aon ? 1 : 0.3 }} />
                          <span className="font-mono text-[9px] uppercase tracking-wider flex-1 transition-opacity"
                            style={{ color: aon ? def.color : pc.textOff }}>IP Communal Land</span>
                          <span className="font-mono text-[8px]" style={{ color: aon ? pc.textMid : pc.textOff }}>{aon ? "ON" : "OFF"}</span>
                        </button>
                        {aon && (
                          <div className="pl-4 pr-2 pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[8px]" style={{ color: pc.label }}>OPACITY</span>
                              <input type="range" min={0.1} max={1} step={0.05}
                                value={areaOpacity["ip_land"]}
                                onChange={(e) => setOpacity("ip_land", parseFloat(e.target.value))}
                                className="flex-1 h-1 cursor-pointer"
                                style={{ accentColor: def.color }} />
                              <span className="font-mono text-[8px] w-7 text-right" style={{ color: pc.label }}>{Math.round(areaOpacity["ip_land"] * 100)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {/* Railway + Road layers — nested under Corridors */}
                  {layer === "corridors" && (["railway", "road_network", "main_road", "other_road"] as AreaKey[]).map((akey) => {
                    const def = AREA_LAYERS[akey];
                    const aon = areaActive.has(akey);
                    return (
                      <div key={akey} className="pl-5">
                        <button
                          onClick={() => toggleArea(akey)}
                          className="w-full flex items-center gap-2 px-2 py-1 transition rounded-sm text-left"
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = pc.hover)}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <span className="w-2 h-0.5 shrink-0 transition-opacity"
                            style={{ backgroundColor: def.color, opacity: aon ? 1 : 0.3 }} />
                          <span className="font-mono text-[9px] uppercase tracking-wider flex-1 transition-opacity"
                            style={{ color: aon ? def.color : pc.textOff }}>{def.label}</span>
                          <span className="font-mono text-[8px]" style={{ color: aon ? pc.textMid : pc.textOff }}>{aon ? "ON" : "OFF"}</span>
                        </button>
                        {aon && (
                          <div className="pl-4 pr-2 pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[8px]" style={{ color: pc.label }}>OPACITY</span>
                              <input type="range" min={0.1} max={1} step={0.05}
                                value={areaOpacity[akey]}
                                onChange={(e) => setOpacity(akey, parseFloat(e.target.value))}
                                className="flex-1 h-1 cursor-pointer"
                                style={{ accentColor: def.color }} />
                              <span className="font-mono text-[8px] w-7 text-right" style={{ color: pc.label }}>{Math.round(areaOpacity[akey] * 100)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Protected Areas area layer — nested under Environment */}
                  {layer === "environment" && (() => {
                    const def = AREA_LAYERS["protected"];
                    const aon = areaActive.has("protected");
                    return (
                      <div className="pl-5">
                        <button
                          onClick={() => toggleArea("protected")}
                          className="w-full flex items-center gap-2 px-2 py-1 transition rounded-sm text-left"
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = pc.hover)}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <span className="w-2 h-2 rounded-sm shrink-0 border transition-opacity"
                            style={{ backgroundColor: `${def.color}55`, borderColor: def.color, opacity: aon ? 1 : 0.3 }} />
                          <span className="font-mono text-[9px] uppercase tracking-wider flex-1 transition-opacity"
                            style={{ color: aon ? def.color : pc.textOff }}>Protected Areas</span>
                          <span className="font-mono text-[8px]" style={{ color: aon ? pc.textMid : pc.textOff }}>{aon ? "ON" : "OFF"}</span>
                        </button>
                        {aon && (
                          <div className="pl-4 pr-2 pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[8px]" style={{ color: pc.label }}>OPACITY</span>
                              <input type="range" min={0.1} max={1} step={0.05}
                                value={areaOpacity["protected"]}
                                onChange={(e) => setOpacity("protected", parseFloat(e.target.value))}
                                className="flex-1 h-1 cursor-pointer"
                                style={{ accentColor: def.color }} />
                              <span className="font-mono text-[8px] w-7 text-right" style={{ color: pc.label }}>{Math.round(areaOpacity["protected"] * 100)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          {/* Area layers */}
          <div className="p-2" style={{ borderTop: `1px solid ${pc.divider}` }}>
            <p className="px-2 py-1 font-mono text-[8px] uppercase tracking-widest" style={{ color: pc.label }}>Area Data</p>
            {ALL_AREAS.filter((k) => k !== "protected" && k !== "ip_land" && k !== "railway" && k !== "road_network" && k !== "main_road" && k !== "other_road").map((k) => {
              const def = AREA_LAYERS[k];
              const on  = areaActive.has(k);
              return (
                <div key={k}>
                  <button
                    onClick={() => toggleArea(k)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 transition rounded-sm text-left"
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = pc.hover)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0 transition-opacity border"
                      style={{ backgroundColor: `${def.color}55`, borderColor: def.color, opacity: on ? 1 : 0.3 }} />
                    <span className="font-mono text-[10px] uppercase tracking-wider flex-1 transition-opacity"
                      style={{ color: on ? pc.textOn : pc.textOff }}>{def.label}</span>
                    <span className="font-mono text-[8px] transition" style={{ color: on ? pc.textMid : pc.textOff }}>
                      {on ? "ON" : "OFF"}
                    </span>
                  </button>
                  {on && (
                    <div className="pl-5 pr-2 pb-2">
                      <p className="font-mono text-[8px] mb-1" style={{ color: pc.textOff }}>{def.hint}</p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[8px]" style={{ color: pc.label }}>OPACITY</span>
                        <input type="range" min={0.1} max={1} step={0.05}
                          value={areaOpacity[k]}
                          onChange={(e) => setOpacity(k, parseFloat(e.target.value))}
                          className="flex-1 h-1 accent-current cursor-pointer"
                          style={{ accentColor: def.color }} />
                        <span className="font-mono text-[8px] w-7 text-right" style={{ color: pc.label }}>{Math.round(areaOpacity[k] * 100)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile 4G coverage */}
          <div className="p-2" style={{ borderTop: `1px solid ${pc.divider}` }}>
            <p className="px-2 py-1 font-mono text-[8px] uppercase tracking-widest" style={{ color: pc.label }}>Mobile 4G Coverage</p>
            {COVERAGE.map((c) => {
              const on = covActive.has(c.key);
              return (
                <button key={c.key} onClick={() => toggleCov(c.key)}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 transition rounded-sm text-left"
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = pc.hover)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0 transition-opacity"
                    style={{ backgroundColor: c.color, opacity: on ? 1 : 0.3 }} />
                  <span className="font-mono text-[10px] uppercase tracking-wider flex-1 transition-opacity"
                    style={{ color: on ? pc.textOn : pc.textOff }}>{c.label}</span>
                  <span className="font-mono text-[8px] transition" style={{ color: on ? pc.textMid : pc.textOff }}>
                    {on ? "ON" : "OFF"}
                  </span>
                </button>
              );
            })}
            {covActive.size > 0 && (
              <div className="pl-5 pr-2 pt-1 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[8px]" style={{ color: pc.label }}>OPACITY</span>
                  <input type="range" min={0.1} max={1} step={0.05}
                    value={covOpacity} onChange={(e) => setCovOpacity(parseFloat(e.target.value))}
                    className="flex-1 h-1 cursor-pointer" style={{ accentColor: "#38bdf8" }} />
                  <span className="font-mono text-[8px] w-7 text-right" style={{ color: pc.label }}>{Math.round(covOpacity * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Intelligence */}
          <div className="p-2" style={{ borderTop: `1px solid ${pc.divider}` }}>
            <p className="px-2 py-1 font-mono text-[8px] uppercase tracking-widest" style={{ color: pc.label }}>Intelligence</p>
            {[
              { key: "news",     label: "News",             color: "#f59e0b", on: newsVisible,     toggle: () => setNewsVisible(v => !v) },
              { key: "projects", label: "Tracked Projects", color: "#818cf8", on: projectsVisible, toggle: () => setProjectsVisible(v => !v) },
            ].map((item) => (
              <button key={item.key} onClick={item.toggle}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 transition rounded-sm text-left"
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = pc.hover)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span className="w-2.5 h-2.5 rounded-sm shrink-0 transition-opacity"
                  style={{ backgroundColor: item.color, opacity: item.on ? 1 : 0.3 }} />
                <span className="font-mono text-[10px] uppercase tracking-wider flex-1 transition-opacity"
                  style={{ color: item.on ? pc.textOn : pc.textOff }}>{item.label}</span>
                <span className="font-mono text-[8px] transition" style={{ color: item.on ? pc.textMid : pc.textOff }}>
                  {item.on ? "ON" : "OFF"}
                </span>
              </button>
            ))}
          </div>

          {/* Basemap switcher */}
          <div className="p-2" style={{ borderTop: `1px solid ${pc.divider}` }}>
            <p className="px-2 py-1 font-mono text-[8px] uppercase tracking-widest" style={{ color: pc.label }}>Basemap</p>
            <div className="flex flex-wrap gap-1.5 px-2 pb-1">
              {(Object.entries(BASEMAPS) as [BasemapKey, BasemapDef][]).map(([key, def]) => (
                <button key={key} onClick={() => pickBasemap(key)} title={def.label}
                  className="flex items-center gap-1 px-2 py-1 font-mono text-[8px] uppercase tracking-wider border transition"
                  style={{
                    borderColor: basemap === key ? "#ff5100" : pc.inactiveBorder,
                    color:       basemap === key ? "#ff5100" : pc.inactiveText,
                    backgroundColor: basemap === key ? "#ff510015" : "transparent",
                  }}
                >
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: def.swatch }} />
                  {def.label}
                </button>
              ))}
            </div>
            <div className="px-2 pt-1 space-y-1">
              <button onClick={() => setFloodVisible((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1 font-mono text-[8px] uppercase tracking-wider border transition w-full"
                style={{
                  borderColor: floodVisible ? "#0ea5e9" : pc.inactiveBorder,
                  color:       floodVisible ? "#0ea5e9" : pc.inactiveText,
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

      {/* ── News panel ────────────────────────────────────── */}
      {newsPanel && !selected && (
        <NewsPanel
          province={newsPanel.province}
          items={newsPanel.items}
          isDark={isDark}
          onClose={() => setNewsPanel(null)}
        />
      )}

      {/* ── Project panel ─────────────────────────────────── */}
      {selectedProject && !selected && (
        <ProjectPanel
          project={selectedProject}
          isDark={isDark}
          onClose={() => setSelectedProject(null)}
        />
      )}
      {/* ── Site hover tooltip ───────────────────────────────── */}
      {hoveredSite && !selected && mousePos && (
        <SiteHoverTooltip site={hoveredSite} isDark={isDark} x={mousePos.x} y={mousePos.y} />
      )}

      {/* ── Area layer hover tooltip ─────────────────────────── */}
      {areaHover && !hoveredSite && (() => {
        const p = areaHover.props;
        const isProtected = areaHover.layerId === "area-protected";
        const isIpLand    = areaHover.layerId === "area-ip_land";
        const ox = 8, oy = 8;
        const isRoad = ["area-railway","area-road_network","area-main_road","area-other_road"].includes(areaHover.layerId);
        const tw = (isProtected || isIpLand) ? 260 : isRoad ? 240 : 220;
        const lx = Math.max(8, Math.min(areaHover.x + ox, window.innerWidth - tw - 8));
        const ly = Math.min(areaHover.y + oy, window.innerHeight - ((isProtected || isIpLand) ? 240 : isRoad ? 160 : 80));
        const bg  = isDark ? "rgba(10,10,10,0.95)"    : "rgba(255,255,255,0.97)";
        const bdr = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
        const txt = isDark ? "#f1f5f9"                : "#1e293b";
        const dim = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.50)";
        const fnt = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.28)";
        const div = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
        const acc = "#34d399";

        if (isProtected) {
          const zoneCatColors: Record<string, string> = {
            "Core zone":           "#375623",
            "Conservation zone":   "#a9d18e",
            "Sustainable use zone":"#d6e87a",
            "Community zone":      "#f4b981",
          };
          const zoneColor = zoneCatColors[p.zone_category as string] ?? acc;
          return (
            <div style={{ position: "fixed", left: lx, top: ly, width: tw, background: bg, border: `1px solid ${bdr}`, borderRadius: 10, overflow: "hidden", pointerEvents: "none", boxShadow: "0 6px 24px rgba(0,0,0,0.30)", zIndex: 999 }}>
              {/* Header bar — zone colour */}
              <div style={{ background: `${zoneColor}22`, borderBottom: `1px solid ${zoneColor}44`, padding: "7px 10px 6px" }}>
                <div style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.12em", color: zoneColor, marginBottom: 2 }}>
                  {p.npa_type as string}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: txt, lineHeight: 1.25 }}>
                  {p.name as string}
                </div>
              </div>
              {/* Body rows */}
              <div style={{ padding: "7px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                {([
                  ["Zone type", p.zone_category as string, zoneColor],
                  ["Area",      p.size_ha ? `${p.size_ha} ha` : "—", undefined],
                  ["Issued",    (p.issued_date as string) ?? "—", undefined],
                ] as [string, string, string | undefined][]).map(([label, value, color]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.10em", color: fnt, whiteSpace: "nowrap" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: color ?? txt, textAlign: "right" }}>{value}</span>
                  </div>
                ))}
                {(p.description as string | undefined) && (
                  <div style={{ marginTop: 2, paddingTop: 5, borderTop: `1px solid ${div}` }}>
                    <div style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.10em", color: fnt, marginBottom: 2 }}>Location</div>
                    <div style={{ fontSize: 10.5, color: dim, lineHeight: 1.45 }}>{(p.description as string).trim()}</div>
                  </div>
                )}
                <div style={{ marginTop: 2, paddingTop: 5, borderTop: `1px solid ${div}`, fontSize: 9, color: fnt, fontFamily: "monospace" }}>
                  {p.reference as string} · ODC 2017
                </div>
              </div>
            </div>
          );
        }

        if (isIpLand) {
          const ipColor = "#f97316";
          return (
            <div style={{ position: "fixed", left: lx, top: ly, width: tw, background: bg, border: `1px solid ${bdr}`, borderRadius: 10, overflow: "hidden", pointerEvents: "none", boxShadow: "0 6px 24px rgba(0,0,0,0.30)", zIndex: 999 }}>
              <div style={{ background: `${ipColor}22`, borderBottom: `1px solid ${ipColor}44`, padding: "7px 10px 6px" }}>
                <div style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.12em", color: ipColor, marginBottom: 2 }}>
                  Indigenous Communal Land · {p.ethnic_group as string}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: txt, lineHeight: 1.25 }}>
                  {[p.village, p.commune, p.district].filter(Boolean).join(", ")}
                </div>
                <div style={{ fontSize: 10.5, color: dim }}>{p.province as string}</div>
              </div>
              <div style={{ padding: "7px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                {([
                  ["Families",     p.num_families ? `${String(p.num_families)} families` : "—", undefined],
                  ["Total area",   p.land_size_ha  ? `${String(p.land_size_ha)} ha`       : "—", undefined],
                  ["Titled",       (p.date_titled as string) ?? "—",               undefined],
                ] as [string, string, string | undefined][]).map(([label, value, color]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.10em", color: fnt, whiteSpace: "nowrap" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: color ?? txt, textAlign: "right" }}>{value}</span>
                  </div>
                ))}
                {!!(p.traditional_agri_ha || p.swidden_farming_ha || p.forest_land_ha) && (
                  <div style={{ marginTop: 2, paddingTop: 5, borderTop: `1px solid ${div}`, display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.10em", color: fnt, marginBottom: 1 }}>Land use breakdown</div>
                    {!!p.traditional_agri_ha && <div style={{ fontSize: 10, color: dim }}>Traditional agri: {String(p.traditional_agri_ha)} ha</div>}
                    {!!p.swidden_farming_ha  && <div style={{ fontSize: 10, color: dim }}>Swidden farming: {String(p.swidden_farming_ha)} ha</div>}
                    {!!p.forest_land_ha      && <div style={{ fontSize: 10, color: dim }}>Forest land: {String(p.forest_land_ha)} ha</div>}
                  </div>
                )}
                <div style={{ marginTop: 2, paddingTop: 5, borderTop: `1px solid ${div}`, fontSize: 9, color: fnt, fontFamily: "monospace" }}>
                  {p.reference as string ?? ""} · ODC
                </div>
              </div>
            </div>
          );
        }

        // Road / Railway rich tooltip
        if (isRoad) {
          const layerKey = areaHover.layerId.replace("area-", "") as AreaKey;
          const layerDef = AREA_LAYERS[layerKey];
          const layerColor = (!isDark && ROAD_LIGHT_MODE_COLORS[layerKey]) ? ROAD_LIGHT_MODE_COLORS[layerKey]! : layerDef?.color ?? acc;
          const isRailway = layerKey === "railway";

          const roadClassLabels: Record<string, string> = {
            trunk: "Trunk Road", trunk_link: "Trunk Link", motorway: "Expressway", motorway_link: "Expressway Link",
            primary: "Primary Road", primary_link: "Primary Link", secondary: "Secondary Road", secondary_link: "Secondary Link",
            tertiary: "Tertiary Road", tertiary_link: "Tertiary Link",
          };
          const fclassStr = p.fclass as string | undefined;
          const roadLabel = fclassStr ? (roadClassLabels[fclassStr] ?? fclassStr) : undefined;
          const nameStr   = p.name as string | undefined;
          const refStr    = p.ref as string | undefined;
          const fromStr   = p.from as string | undefined;
          const toStr     = p.to as string | undefined;
          const lengthStr = p.length_km as string | undefined;
          const statusStr = p.status as string | undefined;
          const sourceStr = p.source as string | undefined;

          const statusColor = statusStr === "Existing" ? "#34d399" : "#fbbf24";

          return (
            <div style={{ position: "fixed", left: lx, top: ly, width: tw, background: bg, border: `1px solid ${bdr}`, borderRadius: 10, overflow: "hidden", pointerEvents: "none", boxShadow: "0 6px 24px rgba(0,0,0,0.28)", zIndex: 999 }}>
              {/* Header */}
              <div style={{ background: `${layerColor}18`, borderBottom: `1px solid ${layerColor}40`, padding: "7px 10px 6px" }}>
                <div style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.12em", color: layerColor, marginBottom: 2 }}>
                  {layerDef?.label ?? layerKey}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: txt, lineHeight: 1.25 }}>
                  {isRailway ? (fromStr && toStr ? `${fromStr} → ${toStr}` : fromStr ?? "Railway Segment") : (nameStr || roadLabel || "Road Segment")}
                </div>
                {!isRailway && nameStr && roadLabel && (
                  <div style={{ fontSize: 10, color: dim, marginTop: 1 }}>{roadLabel}</div>
                )}
              </div>
              {/* Body */}
              <div style={{ padding: "7px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                {isRailway ? ([
                  statusStr ? ["Status",  statusStr,  statusColor] : null,
                  lengthStr ? ["Length",  lengthStr,  undefined]   : null,
                  sourceStr ? ["Source",  sourceStr,  undefined]   : null,
                ] as ([string,string,string|undefined] | null)[]).filter(Boolean).map(([label, value, color]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.10em", color: fnt, whiteSpace: "nowrap" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: color ?? txt, textAlign: "right" }}>{value}</span>
                  </div>
                )) : ([
                  !nameStr && roadLabel ? ["Class",  roadLabel, undefined] : null,
                  refStr               ? ["Ref",    refStr,    undefined]  : null,
                  sourceStr            ? ["Source", sourceStr, undefined]  : null,
                ] as ([string,string,string|undefined] | null)[]).filter(Boolean).map(([label, value, color]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.10em", color: fnt, whiteSpace: "nowrap" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: color ?? txt, textAlign: "right" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Generic tooltip for all other area layers
        const title  = p.from ? `${p.from} → ${p.to}` : (p.name || p.fclass || p.label) as string | undefined;
        const sub    = (p.zone_category || p.npa_type || p.status || p.fclass) as string | undefined;
        const detail = p.size_ha ? `${p.size_ha} ha` : p.length_km ? String(p.length_km) : undefined;
        return (
          <div style={{ position: "fixed", left: lx, top: ly, width: tw, background: bg, border: `1px solid ${bdr}`, borderRadius: 8, padding: "8px 10px", pointerEvents: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", zIndex: 999 }}>
            {title && <div style={{ fontSize: 12, fontWeight: 600, color: txt, lineHeight: 1.3, marginBottom: sub ? 3 : 0 }}>{title}</div>}
            {sub   && <div style={{ fontSize: 11, color: dim }}>{sub}{detail ? ` · ${detail}` : ""}</div>}
            {!title && !sub && <div style={{ fontSize: 11, color: dim }}>{areaHover.layerId.replace("area-", "").replace(/_/g, " ")}</div>}
          </div>
        );
      })()}

      {/* ── Location callout (empty-map click) ───────────────── */}
      {locCallout && !selected && (
        <LocationCallout
          lat={locCallout.lat}
          lng={locCallout.lng}
          address={locCallout.address}
          plusCode={locCallout.plusCode}
          province={locCallout.province}
          district={locCallout.district}
          commune={locCallout.commune}
          loading={locCallout.loading}
          isDark={isDark}
          onClose={() => setLocCallout(null)}
          onUse={handleUseLocation}
        />
      )}
      {/* ── Map legend & sources (bottom-left) ───────────────── */}
      <MapLegend
        floodOn={floodVisible || bm.floodOverlay}
        areaActive={areaActive}
        covActive={covActive}
      />
    </div>
  );
}

/* ── Map legend & source attribution ─────────────────────── */
const FLOOD_LEGEND: { c: string; label: string }[] = [
  { c: "#c8e0fc", label: "Shallow (0.09–1 m)" },
  { c: "#a6d2fb", label: "Moderate (1–3 m)" },
  { c: "#5c8df6", label: "Deep (3–10 m)" },
  { c: "#2f4ff6", label: "Very deep (>10 m)" },
  { c: "#3522f2", label: "Permanent water" },
];

function MapLegend({
  floodOn, areaActive, covActive,
}: {
  floodOn: boolean;
  areaActive: Set<AreaKey>;
  covActive: Set<string>;
}) {
  const [open, setOpen] = useState(true);
  const activeAreas = ALL_AREAS.filter((k) => areaActive.has(k));
  const activeCov = COVERAGE.filter((c) => covActive.has(c.key));
  const hasContent = floodOn || activeAreas.length > 0 || activeCov.length > 0;

  // Build source attribution from what's actually showing (dedup)
  const srcSet = new Set<string>();
  activeAreas.forEach((k) => { if (AREA_LAYERS[k].source) srcSet.add(AREA_LAYERS[k].source!); });
  if (floodOn) srcSet.add("GloFAS / Copernicus EMS");
  if (activeCov.length) srcSet.add("Operator coverage 2023");
  const sources = srcSet.size ? [...srcSet] : ["GADM 4.1"];

  return (
    <div className="absolute bottom-4 left-4 z-[450] max-w-[210px]">
      {hasContent && open && (
        <div className="bg-black/90 backdrop-blur border border-white/12 shadow-2xl mb-1.5">
          <div className="px-3 py-1.5 border-b border-white/8 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">Legend</span>
            <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white text-xs leading-none">✕</button>
          </div>
          <div className="p-2.5 space-y-2">
            {activeAreas.map((k) => {
              const def = AREA_LAYERS[k];
              return (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm shrink-0 border"
                    style={{ backgroundColor: `${def.color}55`, borderColor: def.color }} />
                  <span className="font-mono text-[9px] text-white/70 leading-tight">{def.label}</span>
                </div>
              );
            })}
            {activeCov.length > 0 && (
              <div className={activeAreas.length > 0 ? "pt-1.5 border-t border-white/8" : ""}>
                <p className="font-mono text-[8px] uppercase tracking-wider text-white/35 mb-1">Mobile 4G Coverage</p>
                <div className="space-y-1">
                  {activeCov.map((c) => (
                    <div key={c.key} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="font-mono text-[9px] text-white/60 leading-tight">{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {floodOn && (
              <div className={activeAreas.length > 0 || activeCov.length > 0 ? "pt-1.5 border-t border-white/8" : ""}>
                <p className="font-mono text-[8px] uppercase tracking-wider text-white/35 mb-1">Flood Hazard · 100-yr</p>
                <div className="space-y-1">
                  {FLOOD_LEGEND.map((f) => (
                    <div key={f.label} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: f.c }} />
                      <span className="font-mono text-[9px] text-white/60 leading-tight">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Always-on source attribution strip */}
      <div className="flex items-center gap-1.5">
        {hasContent && !open && (
          <button
            onClick={() => setOpen(true)}
            className="bg-black/90 backdrop-blur border border-white/12 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white/50 hover:text-white/80 transition"
          >
            Legend
          </button>
        )}
        <div className="bg-black/70 backdrop-blur border border-white/8 px-2 py-1">
          <span className="font-mono text-[8px] text-white/35 leading-tight">{sources.join(" · ")}</span>
        </div>
      </div>
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
  lat, lng, address, plusCode, province, district, commune, loading, isDark, onClose, onUse,
}: {
  lat: number; lng: number;
  address: string | null;
  plusCode: string | null;
  province?: string;
  district?: string;
  commune?: string;
  loading: boolean;
  isDark: boolean;
  onClose: () => void;
  onUse: () => void;
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
                {(commune || district || province) ? (
                  <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>
                    {[commune, district, province].filter(Boolean).join(", ")}
                  </p>
                ) : (
                  <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>Cambodia</p>
                )}
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

      <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
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

      <div className="px-4 py-2.5">
        <button
          onClick={onUse}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md font-mono text-[10px] uppercase tracking-widest transition hover:brightness-110 disabled:opacity-40"
          style={{ backgroundColor: "#ff5100", color: "#000" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          Use this location →
        </button>
      </div>
    </div>
  );
}

/* ── Inspector ──────────────────────────────────────────── */
function Inspector({
  site, research, onClose, t, isDark,
}: {
  site: MapSite;
  research: ResearchBrief[];
  onClose: () => void;
  t: (key: string) => string;
  isDark: boolean;
}) {
  const relatedResearch = getRelatedResearch(site, research);
  const { data: siteImages = [] } = useSiteImages(site.id);
  const images = siteImages.length > 0
    ? siteImages.map((i) => i.url)
    : (site.photos && site.photos.length > 0)
      ? site.photos
      : site.image_url ? [site.image_url] : [];
  const [imgIdx,    setImgIdx]    = useState(0);
  const [expanded,  setExpanded]  = useState(false);
  useEffect(() => { setImgIdx(0); }, [site.id]);
  // Auto-scroll every 4s when multiple images
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setImgIdx((i) => (i + 1) % images.length), 4000);
    return () => clearInterval(t);
  }, [images.length, site.id]);

  const layerColor = LAYER_META[site.layer].color;
  const scoreColor = site.score !== undefined
    ? site.score >= 80 ? "#34d399" : site.score >= 65 ? "#fbbf24" : site.score >= 40 ? "#fb923c" : "#f43f5e"
    : "#94a3b8";
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
      className="absolute top-0 right-0 z-[400] flex flex-col h-full max-h-full overflow-hidden shadow-2xl transition-[width] duration-300"
      style={{
        width: expanded ? "min(700px, 92vw)" : "360px",
        maxWidth: "calc(100vw - 2rem)",
        backgroundColor: panelBg,
        borderLeft: `1px solid ${borderCol}`,
      }}
    >
      {/* ── Hero image carousel ── */}
      <div className="relative shrink-0 overflow-hidden bg-black" style={{ height: expanded ? "240px" : "180px" }}>
        {images.length > 0 ? (
          <>
            <img
              key={images[imgIdx]}
              src={images[imgIdx]}
              alt={site.name}
              className="w-full h-full object-cover object-center"
              style={{ filter: "brightness(0.78) contrast(1.1)" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            {/* Prev / Next arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm"
                  style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 2L4 6l4 4"/></svg>
                </button>
                <button
                  onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                  className="absolute right-10 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm"
                  style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 2l4 4-4 4"/></svg>
                </button>
                {/* Dot indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className="w-1.5 h-1.5 rounded-full transition-all"
                      style={{ backgroundColor: i === imgIdx ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)" }} />
                  ))}
                </div>
              </>
            )}
            {/* Image count badge */}
            {images.length > 1 && (
              <div className="absolute bottom-2 right-10">
                <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-sm"
                  style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.6)" }}>
                  {imgIdx + 1}/{images.length}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(145deg, ${layerColor}28 0%, ${panelBg} 100%)` }}>
            <div dangerouslySetInnerHTML={{ __html:
              `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" style="opacity:0.2">
                <g fill="none" stroke="${layerColor}" stroke-width="1">${kindSvg}</g>
              </svg>`
            }} />
          </div>
        )}
        {/* Expand / collapse button */}
        <button onClick={() => setExpanded(e => !e)}
          className="absolute top-3 right-12 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)" }}
          title={expanded ? "Collapse" : "Expand"}>
          {expanded ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="3" y1="21" x2="10" y2="14"/><line x1="21" y1="3" x2="14" y2="10"/>
            </svg>
          )}
        </button>
        {/* Close button */}
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

      {/* ── Data provenance strip ── */}
      {(site.source_tier || site.confidence) && (
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap shrink-0" style={{ borderBottom: `1px solid ${dividerCol}` }}>
          <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: textDim }}>Data</span>
          {site.source_tier && (() => {
            const tier = { 1: { l: "Tier 1 · Official",   c: "#34d399" },
                           2: { l: "Tier 2 · Reputable",  c: "#38bdf8" },
                           3: { l: "Tier 3 · Estimated",  c: "#fbbf24" } }[site.source_tier]
                         ?? { l: `Tier ${site.source_tier}`, c: textDim };
            return <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: tier.c, backgroundColor: tier.c + "14" }}>{tier.l}</span>;
          })()}
          {site.confidence && (() => {
            const c = site.confidence === "high" ? "#34d399" : site.confidence === "medium" ? "#fbbf24" : "#f87171";
            return <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: c, backgroundColor: c + "14" }}>{site.confidence} confidence</span>;
          })()}
          {(() => {
            const at = site.data_verified_at ? new Date(site.data_verified_at) : null;
            const stale = !at || (Date.now() - at.getTime()) > 365 * 24 * 3600 * 1000;
            return (
              <span className="font-mono text-[8px] uppercase tracking-wider" style={{ color: stale ? "#f87171" : textDim }}>
                {at ? `verified ${at.toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : "unverified"}
                {stale && " · stale"}
              </span>
            );
          })()}
          <a href="/methodology" target="_blank" rel="noreferrer"
            className="font-mono text-[8px] uppercase tracking-wider ml-auto hover:underline" style={{ color: textDim }}>
            Methodology ↗
          </a>
        </div>
      )}

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
          ...(site.website ? [{
            label: "Website",
            href: site.website.startsWith("http") ? site.website : `https://${site.website}`,
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
              </svg>
            ),
          }] : []),
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
      {expanded ? (
        <>
        {/* ── Wide 2-column layout ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          {/* Left column */}
          <div style={{ borderRight: `1px solid ${dividerCol}` }}>

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

        {/* Quick stat tiles: elevation, area, road */}
        {(site.elevation_m != null || site.size || site.road) && (
          <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: dividerCol, borderBottom: `1px solid ${dividerCol}` }}>
            {false && null /* port tile moved to Connectivity section */}
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

          </div>{/* end left col */}
          {/* Right column */}
          <div>

        {/* Logistics connectivity */}
        {(site.port_distance_km != null || site.airport_distance_km != null || site.rail_distance_km != null || site.border_distance_km != null) && (
          <div style={{ borderBottom: `1px solid ${dividerCol}`, padding: "12px 16px" }}>
            <div className="flex items-baseline justify-between mb-2">
              <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: textDim }}>Connectivity</p>
              <span className="font-mono text-[8px] tracking-wide" style={{ color: textDim }}>straight-line est.</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {site.port_distance_km != null && (
                <div style={{ background: isDark ? "rgba(55,138,221,0.08)" : "rgba(55,138,221,0.06)", borderRadius: "6px", padding: "8px 10px" }}>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-1" style={{ color: "#378ADD" }}>Port</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{Math.round(site.port_distance_km)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>km</span></p>
                  {site.nearest_port && <p className="text-[10px] mt-0.5 truncate" style={{ color: textDim }}>{site.nearest_port}</p>}
                </div>
              )}
              {site.airport_distance_km != null && (
                <div style={{ background: isDark ? "rgba(29,158,117,0.08)" : "rgba(29,158,117,0.06)", borderRadius: "6px", padding: "8px 10px" }}>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-1" style={{ color: "#1D9E75" }}>Airport</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{Math.round(site.airport_distance_km)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>km</span></p>
                  {site.nearest_airport && <p className="text-[10px] mt-0.5 truncate" style={{ color: textDim }}>{site.nearest_airport}</p>}
                </div>
              )}
              {site.rail_distance_km != null && (
                <div style={{ background: isDark ? "rgba(186,117,23,0.08)" : "rgba(186,117,23,0.06)", borderRadius: "6px", padding: "8px 10px" }}>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-1" style={{ color: "#BA7517" }}>Rail</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{Math.round(site.rail_distance_km)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>km</span></p>
                  {site.nearest_rail && <p className="text-[10px] mt-0.5 truncate" style={{ color: textDim }}>{site.nearest_rail}</p>}
                </div>
              )}
              {site.border_distance_km != null && (
                <div style={{ background: isDark ? "rgba(216,90,48,0.08)" : "rgba(216,90,48,0.06)", borderRadius: "6px", padding: "8px 10px" }}>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-1" style={{ color: "#D85A30" }}>Border</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{Math.round(site.border_distance_km)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>km</span></p>
                  {site.nearest_border && <p className="text-[10px] mt-0.5 truncate" style={{ color: textDim }}>{site.nearest_border}</p>}
                </div>
              )}
            </div>
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

        {/* Key info table */}
        {(site.operator || site.website || site.phone || site.utilities || site.year_commissioned ||
          site.tenant_count || site.export_value_usd || site.employee_count || site.zone_types ||
          site.on_site_facilities || site.city_distance_km || site.stock_ticker ||
          site.developer || site.financier || site.capacity_mw || site.eia_registered) && (
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: textDim }}>Details</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <tbody>
                {site.operator && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top", width: "32%" }}>Operator</td>
                    <td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>{site.operator}</td>
                  </tr>
                )}
                {site.developer && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top", width: "32%" }}>Developer</td>
                    <td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>{site.developer}</td>
                  </tr>
                )}
                {site.financier && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Financier</td>
                    <td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top" }}>{site.financier}</td>
                  </tr>
                )}
                {site.capacity_mw && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Capacity</td>
                    <td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>
                      {site.capacity_mw} MW{site.avg_annual_mwh ? ` · ${(site.avg_annual_mwh / 1000).toFixed(0)} GWh/yr` : ""}
                    </td>
                  </tr>
                )}
                {site.year_commissioned && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Est.</td>
                    <td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>{site.year_commissioned}</td>
                  </tr>
                )}
                {site.tributary && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Watershed</td>
                    <td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top" }}>{site.tributary}</td>
                  </tr>
                )}
                {site.eia_registered && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>EIA</td>
                    <td style={{ paddingBottom: "6px", verticalAlign: "top" }}>
                      <span style={{ display: "inline-block", background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a55", borderRadius: "4px", padding: "1px 6px", fontSize: "10px", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
                        {site.eia_type === "Completed Environmental Impact Assessment" ? "Full EIA" : "Initial EIA"}
                      </span>
                    </td>
                  </tr>
                )}
                {site.stock_ticker && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Listed</td>
                    <td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top", fontFamily: "var(--font-mono)" }}>{site.stock_ticker}</td>
                  </tr>
                )}
                {site.tenant_count && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Tenants</td>
                    <td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>
                      {site.tenant_count} companies{site.country_count ? ` · ${site.country_count} countries` : ""}
                    </td>
                  </tr>
                )}
                {site.employee_count && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Workers</td>
                    <td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>~{site.employee_count.toLocaleString()}</td>
                  </tr>
                )}
                {site.export_value_usd && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Exports</td>
                    <td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>
                      USD {site.export_value_usd >= 1_000_000_000
                        ? `${(site.export_value_usd / 1_000_000_000).toFixed(2)}B`
                        : `${(site.export_value_usd / 1_000_000).toFixed(0)}M`} / yr
                    </td>
                  </tr>
                )}
                {site.zone_types && site.zone_types.length > 0 && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Zones</td>
                    <td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top" }}>{site.zone_types.join(" · ")}</td>
                  </tr>
                )}
                {site.city_distance_km && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>City</td>
                    <td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top" }}>{site.city_distance_km} km to city centre</td>
                  </tr>
                )}
                {site.utilities && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Utilities</td>
                    <td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top" }}>{site.utilities}</td>
                  </tr>
                )}
                {site.on_site_facilities && site.on_site_facilities.length > 0 && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Facilities</td>
                    <td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top", lineHeight: "1.6" }}>
                      {site.on_site_facilities.join(" · ")}
                    </td>
                  </tr>
                )}
                {site.website && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Website</td>
                    <td style={{ paddingBottom: "6px", verticalAlign: "top" }}>
                      <a href={site.website} target="_blank" rel="noopener noreferrer"
                        style={{ color: accentBlue, textDecoration: "none", fontSize: "12px" }}>
                        {site.website.replace(/^https?:\/\//, "")}
                      </a>
                    </td>
                  </tr>
                )}
                {site.phone && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Phone</td>
                    <td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>{site.phone}</td>
                  </tr>
                )}
                {site.data_verified_at && (
                  <tr>
                    <td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Verified</td>
                    <td style={{ color: textDim, paddingBottom: "6px", verticalAlign: "top", fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                      {new Date(site.data_verified_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                      {site.data_source_url && (
                        <a href={site.data_source_url} target="_blank" rel="noopener noreferrer"
                          style={{ marginLeft: "8px", color: accentBlue, textDecoration: "none" }}>source ↗</a>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes / description */}
        {site.notes && (
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: textDim }}>About</p>
            <p className="text-[12px] leading-relaxed" style={{ color: textMuted }}>{site.notes}</p>
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

          </div>{/* end right col */}
        </div>{/* end 2-col grid */}
        {/* Disclaimer footer (expanded) */}
        <div className="px-4 py-3">
          <p className="font-mono text-[9px]" style={{ color: textDim }}>{t("map.disclaimer")}</p>
        </div>
        </>
      ) : (
        /* ── Compact single-column layout ── */
        <>

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

        {/* Quick stat tiles */}
        {(site.elevation_m != null || site.size || site.road) && (
          <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: dividerCol, borderBottom: `1px solid ${dividerCol}` }}>
            {site.elevation_m != null && (
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: panelBg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 20 22 20"/></svg>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-0.5" style={{ color: textDim }}>Elevation</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: site.elevation_m >= 5 ? "#34d399" : site.elevation_m >= 2 ? "#fbbf24" : "#f43f5e" }}>
                    {Math.round(site.elevation_m)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>m</span>
                  </p>
                </div>
              </div>
            )}
            {site.size && (
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: panelBg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-0.5" style={{ color: textDim }}>Area</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{site.size}</p>
                </div>
              </div>
            )}
            {site.road && (
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: panelBg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20V4M21 20V4M8 20V4M16 20V4"/></svg>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-0.5" style={{ color: textDim }}>Road</p>
                  <p className="font-semibold text-[11px] leading-snug truncate max-w-[100px]" style={{ color: textMain }}>{site.road}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logistics connectivity */}
        {(site.port_distance_km != null || site.airport_distance_km != null || site.rail_distance_km != null || site.border_distance_km != null) && (
          <div style={{ borderBottom: `1px solid ${dividerCol}`, padding: "12px 16px" }}>
            <div className="flex items-baseline justify-between mb-2">
              <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: textDim }}>Connectivity</p>
              <span className="font-mono text-[8px] tracking-wide" style={{ color: textDim }}>straight-line est.</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {site.port_distance_km != null && (
                <div style={{ background: isDark ? "rgba(55,138,221,0.08)" : "rgba(55,138,221,0.06)", borderRadius: "6px", padding: "8px 10px" }}>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-1" style={{ color: "#378ADD" }}>Port</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{Math.round(site.port_distance_km)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>km</span></p>
                  {site.nearest_port && <p className="text-[10px] mt-0.5 truncate" style={{ color: textDim }}>{site.nearest_port}</p>}
                </div>
              )}
              {site.airport_distance_km != null && (
                <div style={{ background: isDark ? "rgba(29,158,117,0.08)" : "rgba(29,158,117,0.06)", borderRadius: "6px", padding: "8px 10px" }}>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-1" style={{ color: "#1D9E75" }}>Airport</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{Math.round(site.airport_distance_km)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>km</span></p>
                  {site.nearest_airport && <p className="text-[10px] mt-0.5 truncate" style={{ color: textDim }}>{site.nearest_airport}</p>}
                </div>
              )}
              {site.rail_distance_km != null && (
                <div style={{ background: isDark ? "rgba(186,117,23,0.08)" : "rgba(186,117,23,0.06)", borderRadius: "6px", padding: "8px 10px" }}>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-1" style={{ color: "#BA7517" }}>Rail</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{Math.round(site.rail_distance_km)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>km</span></p>
                  {site.nearest_rail && <p className="text-[10px] mt-0.5 truncate" style={{ color: textDim }}>{site.nearest_rail}</p>}
                </div>
              )}
              {site.border_distance_km != null && (
                <div style={{ background: isDark ? "rgba(216,90,48,0.08)" : "rgba(216,90,48,0.06)", borderRadius: "6px", padding: "8px 10px" }}>
                  <p className="font-mono text-[8px] uppercase tracking-widest mb-1" style={{ color: "#D85A30" }}>Border</p>
                  <p className="font-semibold text-[13px] leading-none" style={{ color: textMain }}>{Math.round(site.border_distance_km)} <span className="text-[10px] font-normal" style={{ color: textMuted }}>km</span></p>
                  {site.nearest_border && <p className="text-[10px] mt-0.5 truncate" style={{ color: textDim }}>{site.nearest_border}</p>}
                </div>
              )}
            </div>
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
            <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ color: "#34d399", backgroundColor: "#34d39912" }}>✓ GPS</span>
          ) : (
            <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ color: "#fbbf24", backgroundColor: "#fbbf2412" }}>est.</span>
          )}
        </div>

        {/* Key info table */}
        {(site.operator || site.website || site.phone || site.utilities || site.year_commissioned ||
          site.tenant_count || site.export_value_usd || site.employee_count || site.zone_types ||
          site.on_site_facilities || site.city_distance_km || site.stock_ticker ||
          site.developer || site.financier || site.capacity_mw || site.eia_registered) && (
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: textDim }}>Details</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <tbody>
                {site.operator && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top", width: "32%" }}>Operator</td><td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>{site.operator}</td></tr>)}
                {site.developer && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top", width: "32%" }}>Developer</td><td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>{site.developer}</td></tr>)}
                {site.financier && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Financier</td><td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top" }}>{site.financier}</td></tr>)}
                {site.capacity_mw && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Capacity</td><td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>{site.capacity_mw} MW{site.avg_annual_mwh ? ` · ${(site.avg_annual_mwh / 1000).toFixed(0)} GWh/yr` : ""}</td></tr>)}
                {site.year_commissioned && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Est.</td><td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>{site.year_commissioned}</td></tr>)}
                {site.tributary && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Watershed</td><td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top" }}>{site.tributary}</td></tr>)}
                {site.eia_registered && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>EIA</td><td style={{ paddingBottom: "6px", verticalAlign: "top" }}><span style={{ display: "inline-block", background: "#16a34a22", color: "#16a34a", border: "1px solid #16a34a55", borderRadius: "4px", padding: "1px 6px", fontSize: "10px", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>{site.eia_type === "Completed Environmental Impact Assessment" ? "Full EIA" : "Initial EIA"}</span></td></tr>)}
                {site.stock_ticker && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Listed</td><td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top", fontFamily: "var(--font-mono)" }}>{site.stock_ticker}</td></tr>)}
                {site.tenant_count && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Tenants</td><td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>{site.tenant_count} companies{site.country_count ? ` · ${site.country_count} countries` : ""}</td></tr>)}
                {site.employee_count && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Workers</td><td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>~{site.employee_count.toLocaleString()}</td></tr>)}
                {site.export_value_usd && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Exports</td><td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>USD {site.export_value_usd >= 1_000_000_000 ? `${(site.export_value_usd / 1_000_000_000).toFixed(2)}B` : `${(site.export_value_usd / 1_000_000).toFixed(0)}M`} / yr</td></tr>)}
                {site.zone_types && site.zone_types.length > 0 && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Zones</td><td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top" }}>{site.zone_types.join(" · ")}</td></tr>)}
                {site.city_distance_km && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>City</td><td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top" }}>{site.city_distance_km} km to city centre</td></tr>)}
                {site.utilities && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Utilities</td><td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top" }}>{site.utilities}</td></tr>)}
                {site.on_site_facilities && site.on_site_facilities.length > 0 && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Facilities</td><td style={{ color: textMuted, paddingBottom: "6px", verticalAlign: "top", lineHeight: "1.6" }}>{site.on_site_facilities.join(" · ")}</td></tr>)}
                {site.website && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Website</td><td style={{ paddingBottom: "6px", verticalAlign: "top" }}><a href={site.website} target="_blank" rel="noopener noreferrer" style={{ color: accentBlue, textDecoration: "none", fontSize: "12px" }}>{site.website.replace(/^https?:\/\//, "")}</a></td></tr>)}
                {site.phone && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Phone</td><td style={{ color: textMain, paddingBottom: "6px", verticalAlign: "top" }}>{site.phone}</td></tr>)}
                {site.data_verified_at && (<tr><td style={{ color: textDim, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "6px", paddingRight: "12px", whiteSpace: "nowrap", verticalAlign: "top" }}>Verified</td><td style={{ color: textDim, paddingBottom: "6px", verticalAlign: "top", fontFamily: "var(--font-mono)", fontSize: "10px" }}>{new Date(site.data_verified_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}{site.data_source_url && (<a href={site.data_source_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "8px", color: accentBlue, textDecoration: "none" }}>source ↗</a>)}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {site.notes && (
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: textDim }}>About</p>
            <p className="text-[12px] leading-relaxed" style={{ color: textMuted }}>{site.notes}</p>
          </div>
        )}

        {/* EIP score */}
        {(site.score !== undefined || hasEip) && (
          <div className="px-4 py-4" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: textDim }}>EIP Suitability Score</p>
              <div className="flex items-baseline gap-1">
                {site.eip_tier && (<span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded mr-1" style={{ color: site.eip_tier === "gold" ? "#fbbf24" : site.eip_tier === "silver" ? "#94a3b8" : "#f97316", backgroundColor: site.eip_tier === "gold" ? "#fbbf2415" : site.eip_tier === "silver" ? "#94a3b815" : "#f9731615" }}>{site.eip_tier}</span>)}
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
                <span key={ind} className="px-2.5 py-1 text-[11px] rounded-full border" style={{ backgroundColor: `${layerColor}10`, borderColor: `${layerColor}40`, color: layerColor }}>{ind}</span>
              ))}
            </div>
          </div>
        )}

        {/* Strengths + Constraints */}
        {(!!site.strengths?.length || !!site.constraints?.length) && (
          <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            {!!site.strengths?.length && (<><p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: textDim }}>Strengths</p><ul className="space-y-2 mb-3">{site.strengths.map((s) => (<li key={s} className="flex items-start gap-2.5 text-[12px] leading-snug" style={{ color: textMuted }}><span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] mt-0.5" style={{ backgroundColor: "#34d39918", color: "#34d399" }}>✓</span>{s}</li>))}</ul></>)}
            {!!site.constraints?.length && (<><p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: textDim }}>Constraints</p><ul className="space-y-2">{site.constraints.map((c) => (<li key={c} className="flex items-start gap-2.5 text-[12px] leading-snug" style={{ color: textMuted }}><span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] mt-0.5" style={{ backgroundColor: "#f43f5e18", color: "#f43f5e" }}>!</span>{c}</li>))}</ul></>)}
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

        {/* Related research */}
        {relatedResearch.length > 0 && (
          <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2.5" style={{ color: textDim }}>Related Research</p>
            <div className="space-y-2">
              {relatedResearch.map((r) => (
                <div key={r.id} className="flex gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider mb-1 rounded-full" style={{ backgroundColor: "#818cf818", color: "#818cf8" }}>{r.category}</span>
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
      </>
      )}
      </div>
    </aside>
  );
}

/* ── News Panel ─────────────────────────────────────────── */
function NewsPanel({
  province, items, isDark, onClose,
}: {
  province: string;
  items: NewsItem[];
  isDark: boolean;
  onClose: () => void;
}) {
  const panelBg   = isDark ? "#111113" : "#ffffff";
  const panelBg2  = isDark ? "#18181b" : "#f8f9fa";
  const borderCol = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)";
  const textMain  = isDark ? "#f8fafc" : "#0f172a";
  const textMuted = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)";
  const textDim   = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.28)";
  const dividerCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  const SECTOR_COLOR: Record<string, string> = {
    "Infrastructure": "#38bdf8",
    "Energy":         "#34d399",
    "Policy":         "#a78bfa",
    "Garment":        "#f472b6",
    "Automotive":     "#60a5fa",
    "Data Center":    "#818cf8",
    "Electronics":    "#22d3ee",
    "Warehousing":    "#fb923c",
    "Food Processing": "#fbbf24",
  };

  return (
    <aside
      className="absolute top-0 right-0 z-[400] w-[360px] max-w-[calc(100vw-2rem)] flex flex-col h-full max-h-full overflow-hidden shadow-2xl"
      style={{ backgroundColor: panelBg, borderLeft: `1px solid ${borderCol}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: `1px solid ${dividerCol}` }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400">News</span>
          </div>
          <h2 className="font-bold text-[17px] leading-tight" style={{ color: textMain }}>{province}</h2>
          <p className="text-[12px] mt-0.5" style={{ color: textMuted }}>{items.length} recent item{items.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
          style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", color: textMuted }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l8 8M9 1L1 9"/>
          </svg>
        </button>
      </div>

      {/* Articles list */}
      <div className="overflow-y-auto flex-1">
        {items.map((item, i) => {
          const scolor = SECTOR_COLOR[item.sector] ?? "#94a3b8";
          return (
            <div key={item.id}
              className="px-4 py-3.5"
              style={{ borderBottom: i < items.length - 1 ? `1px solid ${dividerCol}` : "none" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider rounded-full"
                  style={{ color: scolor, backgroundColor: scolor + "18" }}>
                  {item.sector}
                </span>
                <span className="font-mono text-[9px]" style={{ color: textDim }}>{item.date}</span>
              </div>
              <p className="text-[13px] font-semibold leading-snug mb-1.5" style={{ color: textMain }}>
                {item.headline}
              </p>
              <p className="text-[12px] leading-relaxed mb-2" style={{ color: textMuted }}>
                {item.summary}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px]" style={{ color: textDim }}>{item.source}</span>
                {item.url && item.url !== "#" && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-[9px] uppercase tracking-wider hover:opacity-70 transition"
                    style={{ color: "#f59e0b" }}>
                    Read ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}

        <div className="px-4 py-3">
          <p className="font-mono text-[9px]" style={{ color: textDim }}>
            News items are sourced by automated agents and may not reflect the latest developments.
          </p>
        </div>
      </div>
    </aside>
  );
}

/* ── Project Panel ───────────────────────────────────────── */
function ProjectPanel({
  project, isDark, onClose,
}: {
  project: TrackedProject;
  isDark: boolean;
  onClose: () => void;
}) {
  const panelBg   = isDark ? "#111113" : "#ffffff";
  const borderCol = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)";
  const textMain  = isDark ? "#f8fafc" : "#0f172a";
  const textMuted = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)";
  const textDim   = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.28)";
  const dividerCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const panelBg2  = isDark ? "#18181b" : "#f8f9fa";

  const statusColor = project.status === "Operational" ? "#34d399"
    : project.status === "Under Construction" ? "#fbbf24" : "#818cf8";

  const mapsUrl = project.lat
    ? `https://www.google.com/maps/dir/?api=1&destination=${project.lat},${project.lng}`
    : undefined;

  const rows: { k: string; v: string }[] = [
    { k: "Investor",  v: project.investor },
    { k: "Origin",    v: project.origin },
    { k: "Province",  v: project.province },
    { k: "Size",      v: project.size },
    { k: "Status",    v: project.status },
    { k: "Updated",   v: project.updated },
    ...(project.investment_usd   ? [{ k: "Investment",  v: project.investment_usd }]   : []),
    ...(project.planned_finish   ? [{ k: "Est. Finish", v: project.planned_finish }]   : []),
    ...(project.cdc_approval_date ? [{ k: "CDC Approval", v: project.cdc_approval_date }] : []),
  ];

  return (
    <aside
      className="absolute top-0 right-0 z-[400] w-[360px] max-w-[calc(100vw-2rem)] flex flex-col h-full max-h-full overflow-hidden shadow-2xl"
      style={{ backgroundColor: panelBg, borderLeft: `1px solid ${borderCol}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: `1px solid ${dividerCol}` }}>
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: statusColor }}>
              Tracked Project · {project.sector}
            </span>
          </div>
          <h2 className="font-bold text-[16px] leading-tight" style={{ color: textMain }}>{project.name}</h2>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", color: textMuted }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l8 8M9 1L1 9"/>
          </svg>
        </button>
      </div>

      {/* Action buttons */}
      {(mapsUrl || project.source_url) && (
        <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${dividerCol}` }}>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 group">
              <div className="w-9 h-9 rounded-full flex items-center justify-center transition group-hover:brightness-90"
                style={{ backgroundColor: panelBg2, color: isDark ? "#60a5fa" : "#1a73e8" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: isDark ? "#60a5fa" : "#1a73e8" }}>Directions</span>
            </a>
          )}
          {project.source_url && (
            <a href={project.source_url} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 group">
              <div className="w-9 h-9 rounded-full flex items-center justify-center transition group-hover:brightness-90"
                style={{ backgroundColor: panelBg2, color: isDark ? "#60a5fa" : "#1a73e8" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                </svg>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: isDark ? "#60a5fa" : "#1a73e8" }}>Source</span>
            </a>
          )}
        </div>
      )}

      {/* Scrollable content */}
      <div className="overflow-y-auto flex-1">
        {/* Summary */}
        <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
          <p className="text-[13px] leading-relaxed" style={{ color: textMuted }}>{project.summary}</p>
        </div>

        {/* Key facts */}
        <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
          <p className="font-mono text-[9px] uppercase tracking-widest mb-2.5" style={{ color: textDim }}>Details</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {rows.map(({ k, v }) => (
              <>
                <dt key={`${k}-k`} className="font-mono text-[9px] uppercase tracking-widest" style={{ color: textDim }}>{k}</dt>
                <dd key={`${k}-v`} className="text-[12px]" style={{ color: textMain }}>{v}</dd>
              </>
            ))}
          </dl>
        </div>

        {/* Latest news */}
        {project.latest_news_headline && (
          <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dividerCol}` }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: textDim }}>Latest News</p>
            <p className="text-[12px] font-semibold leading-snug mb-1" style={{ color: textMain }}>
              {project.latest_news_headline}
            </p>
            {project.latest_news_date && (
              <p className="font-mono text-[10px] mb-1.5" style={{ color: textDim }}>{project.latest_news_date}</p>
            )}
            {project.latest_news_url && project.latest_news_url !== "#" && (
              <a href={project.latest_news_url} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[9px] uppercase tracking-wider hover:opacity-70 transition"
                style={{ color: "#818cf8" }}>
                Read article ↗
              </a>
            )}
          </div>
        )}

        <div className="px-4 py-3">
          <p className="font-mono text-[9px]" style={{ color: textDim }}>
            Project data sourced from CDC approvals, investor announcements and agent enrichment. Verify before use.
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
