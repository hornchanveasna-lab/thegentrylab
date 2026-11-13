/**
 * Free, key-less map + geocoding providers (replaces Google Maps, which
 * billed per map load / geocode).
 *
 * - Vector basemaps: OpenFreeMap (free, no key, commercial use allowed)
 * - Terrain raster:  OpenTopoMap (CC-BY-SA, fair use)
 * - Satellite:       Esri World Imagery (+ Esri place labels for "hybrid")
 * - Geocoding:       Photon by Komoot (OpenStreetMap data, fair use)
 *
 * Keep attribution visible on every map — it is a licence condition.
 */
import type { StyleSpecification } from "maplibre-gl";

export const CAMBODIA_BBOX: [number, number, number, number] = [102.3, 9.9, 107.7, 14.7]; // W,S,E,N

const OFM = "https://tiles.openfreemap.org/styles";

export const STYLE_URLS = {
  liberty: `${OFM}/liberty`,
  positron: `${OFM}/positron`,
  dark: `${OFM}/dark`,
} as const;

const ESRI_ATTR =
  'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics';

/** Raster-only style (satellite, terrain). `labels` adds Esri place names on top (Google "hybrid"). */
function rasterStyle(
  tiles: string[],
  attribution: string,
  opts: { labels?: boolean; maxzoom?: number } = {},
): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      base: { type: "raster", tiles, tileSize: 256, attribution, maxzoom: opts.maxzoom ?? 19 },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
  if (opts.labels) {
    style.sources.labels = {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
    };
    style.layers.push({ id: "labels", type: "raster", source: "labels" });
  }
  return style;
}

export const SATELLITE_STYLE = rasterStyle(
  ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
  ESRI_ATTR,
  { labels: true },
);

export const SATELLITE_PLAIN_STYLE = rasterStyle(
  ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
  ESRI_ATTR,
);

export const TERRAIN_STYLE = rasterStyle(
  [
    "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
    "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
  ],
  'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, SRTM | Style © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA)',
  { maxzoom: 17 },
);

/* ── Geocoding (Photon) ─────────────────────────────────────────── */

export type GeoResult = {
  id: string;
  label: string;
  secondary: string;
  lat: number;
  lng: number;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | number | undefined>;
};

const PHOTON = "https://photon.komoot.io";

function toResult(f: PhotonFeature): GeoResult {
  const p = f.properties;
  const name = (p.name as string) || (p.street as string) || (p.city as string) || "Unnamed place";
  const secondary = [p.street && p.name ? p.street : undefined, p.district, p.city, p.state, p.country]
    .filter((v, i, a) => v && v !== name && a.indexOf(v) === i)
    .join(", ");
  return {
    id: `${p.osm_type ?? ""}${p.osm_id ?? `${f.geometry.coordinates.join(",")}`}`,
    label: name,
    secondary,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  };
}

/** Free-text place search, limited to Cambodia. */
export async function searchPlaces(query: string, limit = 5, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=${limit}&lang=en&bbox=${CAMBODIA_BBOX.join(",")}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: PhotonFeature[] };
    return (json.features ?? []).map(toResult);
  } catch {
    return [];
  }
}

/** Best single match for a query, as [lat, lng]. */
export async function geocodePlace(query: string): Promise<[number, number] | null> {
  const [first] = await searchPlaces(query, 1);
  return first ? [first.lat, first.lng] : null;
}

/** Coordinates → readable address (or null). */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&limit=1&lang=en`);
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: PhotonFeature[] };
    const f = json.features?.[0];
    if (!f) return null;
    const r = toResult(f);
    return r.secondary ? `${r.label}, ${r.secondary}` : r.label;
  } catch {
    return null;
  }
}

/** A GeoJSON polygon approximating a circle (for radius rings). */
export function circlePolygon(lat: number, lng: number, radiusMeters: number, steps = 64): GeoJSON.Polygon {
  const coords: [number, number][] = [];
  const dLat = radiusMeters / 111_320;
  const dLng = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "Polygon", coordinates: [coords] };
}
