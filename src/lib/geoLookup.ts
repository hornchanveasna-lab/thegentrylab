/**
 * geoLookup.ts — resolve a lat/lng into Cambodia's administrative
 * hierarchy (Province / District / Commune) using the same GADM
 * boundary files that back the "Area Data" map layers.
 *
 * Point-in-polygon runs client-side against the already-bundled
 * /geo/*.json files so no extra API calls or costs are involved.
 */

type Ring = [number, number][];
type GeoGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

interface AdminFeature<P> {
  type: "Feature";
  properties: P;
  geometry: GeoGeometry;
}
interface AdminCollection<P> {
  type: "FeatureCollection";
  features: AdminFeature<P>[];
}

interface ProvinceProps { name: string }
interface DistrictProps { name: string; prov: string }
interface CommuneProps { NAME_1: string; NAME_2: string; NAME_3: string }

export interface AdminUnits {
  province?: string;
  district?: string;
  commune?: string;
}

/** Ray-casting point-in-polygon for a single linear ring (outer boundary only). */
function pointInRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lat: number, lng: number, geom: GeoGeometry): boolean {
  if (geom.type === "Polygon") {
    return geom.coordinates.length > 0 && pointInRing(lat, lng, geom.coordinates[0]);
  }
  // MultiPolygon: match if inside any part's outer ring
  return geom.coordinates.some((poly) => poly.length > 0 && pointInRing(lat, lng, poly[0]));
}

/** Bounding-box area — used to disambiguate overlapping matches (see below). */
function bboxArea(geom: GeoGeometry): number {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const scan = (ring: Ring) => {
    for (const [x, y] of ring) {
      if (x < minLng) minLng = x;
      if (x > maxLng) maxLng = x;
      if (y < minLat) minLat = y;
      if (y > maxLat) maxLat = y;
    }
  };
  const rings = geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
  rings.forEach(scan);
  return (maxLng - minLng) * (maxLat - minLat);
}

/** Find the containing feature. Boundary files are simplified for the web,
    so small enclaves (e.g. Phnom Penh inside Kandal's outline) can overlap
    their larger neighbour — when multiple features match, the smallest
    bounding box wins, since that's reliably the more specific one. */
function findContaining<P>(lat: number, lng: number, fc: AdminCollection<P>): P | null {
  let best: { props: P; area: number } | null = null;
  for (const f of fc.features) {
    if (!pointInGeometry(lat, lng, f.geometry)) continue;
    const area = bboxArea(f.geometry);
    if (!best || area < best.area) best = { props: f.properties, area };
  }
  return best?.props ?? null;
}

/* Module-level cache — fetched once per session, reused for every pin. */
let provincesPromise: Promise<AdminCollection<ProvinceProps>> | null = null;
let districtsPromise: Promise<AdminCollection<DistrictProps>> | null = null;
let communesPromise:  Promise<AdminCollection<CommuneProps>>  | null = null;

function loadOnce<T>(cache: { current: Promise<T> | null }, url: string): Promise<T> {
  if (!cache.current) {
    cache.current = fetch(url).then((r) => r.json());
  }
  return cache.current;
}

/** Cleans GADM's no-space accented names (e.g. "BântéayMéanchey" → "Banteay Meanchey"-ish) into something readable. */
function tidyGadmName(name: string): string {
  return name.replace(/([a-zà-ÿ])([A-ZÀ-Ÿ])/g, "$1 $2");
}

/** Resolve lat/lng to { province, district, commune } via point-in-polygon lookups. */
export async function resolveAdminUnits(lat: number, lng: number): Promise<AdminUnits> {
  try {
    const [provinces, districts, communes] = await Promise.all([
      loadOnce({ get current() { return provincesPromise; }, set current(v) { provincesPromise = v; } }, "/geo/provinces.json"),
      loadOnce({ get current() { return districtsPromise; }, set current(v) { districtsPromise = v; } }, "/geo/districts.json"),
      loadOnce({ get current() { return communesPromise; }, set current(v) { communesPromise = v; } }, "/geo/communes.json"),
    ]);

    const province = findContaining(lat, lng, provinces)?.name;
    const district = findContaining(lat, lng, districts)?.name;
    const communeProps = findContaining(lat, lng, communes);

    return {
      province,
      district,
      commune: communeProps ? tidyGadmName(communeProps.NAME_3) : undefined,
    };
  } catch {
    return {};
  }
}

/** GADM province name → the exact label used in the app's PROVINCES dropdowns. */
const PROVINCE_ALIASES: Record<string, string> = {
  "Preah Sihanouk": "Preah Sihanouk (Sihanoukville)",
  "Takeo": "Takéo",
};

export function toDropdownProvince(gadmName: string): string {
  return PROVINCE_ALIASES[gadmName] ?? gadmName;
}
