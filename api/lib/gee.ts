/**
 * gee.ts — Google Earth Engine helper
 *
 * Wraps the callback-based @google/earthengine Node client in promises and
 * exposes a single `getBuiltUpStats` function: given a site's boundary (or a
 * fallback buffer around its point), returns built-up / vegetation stats
 * from the most recent low-cloud Sentinel-2 scene.
 *
 * Auth: expects GEE_SERVICE_ACCOUNT_KEY (the full service-account JSON, as a
 * single-line string) in env. Without it, getBuiltUpStats throws — callers
 * must catch and report "not configured" rather than crash the request.
 */
import ee from "@google/earthengine";

let initPromise: Promise<void> | null = null;

function initEarthEngine(): Promise<void> {
  if (initPromise) return initPromise;

  const rawKey = process.env.GEE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    return Promise.reject(new Error("GEE_SERVICE_ACCOUNT_KEY is not set"));
  }

  let key: object;
  try {
    key = JSON.parse(rawKey);
  } catch {
    return Promise.reject(new Error("GEE_SERVICE_ACCOUNT_KEY is not valid JSON"));
  }

  initPromise = new Promise<void>((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(
      key,
      () => {
        ee.initialize(
          null, null,
          () => resolve(),
          (err: unknown) => reject(new Error(`ee.initialize failed: ${String(err)}`)),
        );
      },
      (err: unknown) => reject(new Error(`authenticateViaPrivateKey failed: ${String(err)}`)),
    );
  });

  return initPromise;
}

export interface BuiltUpStats {
  builtUpPct: number;
  ndviMean: number;
  imageDate: string | null;
  areaAnalyzedHa: number;
  boundarySource: "boundary" | "buffer";
}

/** GeoJSON Polygon/MultiPolygon geometry, as stored in sites.boundary */
type GeoJsonGeometry = { type: string; coordinates: unknown };

const FALLBACK_BUFFER_M = 1500; // ~1.5km radius when no drawn boundary exists

/**
 * Computes built-up-area % and mean NDVI over the last 60 days of
 * Sentinel-2 imagery (cloud cover < 20%) for one site.
 */
export async function getBuiltUpStats(params: {
  lat: number;
  lng: number;
  boundary: GeoJsonGeometry | null;
}): Promise<BuiltUpStats> {
  await initEarthEngine();

  const geometry = params.boundary
    ? ee.Geometry(params.boundary as unknown as object)
    : ee.Geometry.Point([params.lng, params.lat]).buffer(FALLBACK_BUFFER_M);

  const end = new Date();
  const start = new Date(end.getTime() - 60 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const collection = ee
    .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(geometry)
    .filterDate(fmt(start), fmt(end))
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    .sort("system:time_start", false);

  const image = collection.first();

  const ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI");
  const ndbi = image.normalizedDifference(["B11", "B8"]).rename("NDBI");
  // Built-up if NDBI > NDVI and NDBI > 0 — a standard NDBI-vs-NDVI rule.
  const builtUpMask = ndbi.gt(ndvi).and(ndbi.gt(0)).rename("built");

  const stats = builtUpMask.addBands(ndvi).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry,
    scale: 10,
    maxPixels: 1e9,
  });

  const areaM2 = geometry.area(1);
  const imageDateMs = image.get("system:time_start");

  const result = await new Promise<{
    built: number | null; NDVI: number | null; area: number; dateMs: number | null;
  }>((resolve, reject) => {
    ee.List([stats.get("built"), stats.get("NDVI"), areaM2, imageDateMs]).evaluate(
      (vals: [number | null, number | null, number, number | null]) => {
        resolve({ built: vals[0], NDVI: vals[1], area: vals[2], dateMs: vals[3] });
      },
      (err: unknown) => reject(new Error(`evaluate failed: ${String(err)}`)),
    );
  });

  if (result.built === null || result.dateMs === null) {
    throw new Error("No cloud-free Sentinel-2 scene found for this area in the last 60 days");
  }

  return {
    builtUpPct: Math.round(result.built * 1000) / 10,
    ndviMean: Math.round((result.NDVI ?? 0) * 1000) / 1000,
    imageDate: new Date(result.dateMs).toISOString().slice(0, 10),
    areaAnalyzedHa: Math.round((result.area / 10000) * 10) / 10,
    boundarySource: params.boundary ? "boundary" : "buffer",
  };
}
