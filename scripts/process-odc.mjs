/**
 * ODC / generic GeoJSON processor for TheGentryLab map area layers.
 *
 * Drop raw GeoJSON files into scripts/geo-incoming/ named after the layer key:
 *   protected.geojson  →  public/geo/protected.json
 *   elc.geojson        →  public/geo/elc.json
 *   powergrid.geojson  →  public/geo/powergrid.json
 *   mining.geojson     →  public/geo/mining.json
 *
 * For each file it:
 *   - keeps only a small set of useful properties (auto-detected name field)
 *   - rounds coordinates to 4 decimals (~11 m) to shrink size
 *   - writes minified GeoJSON to public/geo/
 *
 * Then flip `available: true` for that layer in IndustrialMap.tsx AREA_LAYERS.
 *
 * Usage: node scripts/process-odc.mjs [incomingDir] [outDir]
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { resolve, basename, extname } from "path";

const IN  = process.argv[2] || "scripts/geo-incoming";
const OUT = process.argv[3] || "public/geo";

// Property keys worth keeping if present (first match wins for the display name)
const NAME_KEYS = ["name", "Name", "NAME", "title", "company", "Company", "PA_NAME", "concession", "PROJECT", "project"];
const EXTRA_KEYS = ["company", "Company", "owner", "type", "Type", "status", "year", "Year",
                    "area_ha", "AREA_HA", "hectares", "size", "province", "Province", "voltage"];

const round = (n) => Math.round(n * 1e4) / 1e4;
function roundCoords(c) {
  if (typeof c[0] === "number") return [round(c[0]), round(c[1])];
  return c.map(roundCoords);
}

function slimProps(p) {
  if (!p) return {};
  const out = {};
  for (const k of NAME_KEYS) { if (p[k] != null && p[k] !== "") { out.name = String(p[k]); break; } }
  for (const k of EXTRA_KEYS) { if (p[k] != null && p[k] !== "" && !(k in out)) out[k] = p[k]; }
  return out;
}

function processFile(infile) {
  const key = basename(infile, extname(infile));
  const src = JSON.parse(readFileSync(resolve(IN, infile), "utf8"));
  const feats = (src.features || []).filter((f) => f && f.geometry);
  const features = feats.map((f) => ({
    type: "Feature",
    properties: slimProps(f.properties),
    geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
  }));
  const json = JSON.stringify({ type: "FeatureCollection", features });
  writeFileSync(resolve(OUT, `${key}.json`), json);
  console.log(`✓ ${key}.json: ${features.length} features, ${(json.length / 1024).toFixed(0)} KB`);
}

if (!existsSync(IN)) {
  console.error(`No incoming dir: ${IN}\nCreate it and drop *.geojson files there. See public/geo/SOURCES.md`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const files = readdirSync(IN).filter((f) => /\.(geojson|json)$/i.test(f));
if (!files.length) { console.error(`No .geojson files in ${IN}`); process.exit(1); }
files.forEach(processFile);
console.log("Done. Now set available:true for these layers in IndustrialMap.tsx.");
