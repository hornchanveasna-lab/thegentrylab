/**
 * GADM GeoJSON processor for TheGentryLab map
 * - Cleans province names to match the app's `province` field
 * - Slims properties to the minimum the map needs
 * - Rounds coordinates to 4 decimals (~11m) to shrink file size
 *
 * Input:  /tmp/gadm41_KHM_1.json (provinces), /tmp/gadm41_KHM_2.json (districts)
 * Output: public/geo/provinces.json, public/geo/districts.json
 *
 * Usage: node scripts/process-geo.mjs <inputDir> <outputDir>
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const IN  = process.argv[2] || "/tmp";
const OUT = process.argv[3] || "public/geo";

// GADM NAME_1 → clean English name matching the app's site.province values
const PROV = {
  "BântéayMéanchey": "Banteay Meanchey",
  "Batdâmbâng": "Battambang",
  "KâmpóngCham": "Kampong Cham",
  "KâmpóngChhnang": "Kampong Chhnang",
  "KâmpóngSpœ": "Kampong Speu",
  "KâmpóngThum": "Kampong Thom",
  "Kâmpôt": "Kampot",
  "Kândal": "Kandal",
  "KaôhKong": "Koh Kong",
  "Kep": "Kep",
  "Krâchéh": "Kratié",
  "KrongPailin": "Pailin",
  "KrongPreahSihanouk": "Preah Sihanouk",
  "MôndólKiri": "Mondulkiri",
  "OtdarMeanChey": "Oddar Meanchey",
  "PhnomPenh": "Phnom Penh",
  "Pouthisat": "Pursat",
  "PreahVihéar": "Preah Vihear",
  "PreyVêng": "Prey Veng",
  "Rôtânôkiri": "Ratanakiri",
  "Siemréab": "Siem Reap",
  "StœngTrêng": "Stung Treng",
  "SvayRieng": "Svay Rieng",
  "Takêv": "Takeo",
  "TbongKhmum": "Tboung Khmum",
};

// Insert a space before capitals to de-smash GADM district names: "PhnumKravanh" → "Phnum Kravanh"
function deSmash(s) {
  if (!s || s === "NA") return s;
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

const round = (n) => Math.round(n * 1e4) / 1e4;

function roundCoords(c) {
  if (typeof c[0] === "number") return [round(c[0]), round(c[1])];
  return c.map(roundCoords);
}

function processLayer(infile, outfile, mapProps) {
  const src = JSON.parse(readFileSync(resolve(IN, infile), "utf8"));
  const features = src.features.map((f) => ({
    type: "Feature",
    properties: mapProps(f.properties),
    geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
  }));
  const out = { type: "FeatureCollection", features };
  const json = JSON.stringify(out);
  writeFileSync(resolve(OUT, outfile), json);
  const kb = (json.length / 1024).toFixed(0);
  console.log(`✓ ${outfile}: ${features.length} features, ${kb} KB`);
}

mkdirSync(OUT, { recursive: true });

processLayer("gadm41_KHM_1.json", "provinces.json", (p) => ({
  name: PROV[p.NAME_1] ?? deSmash(p.NAME_1),
}));

processLayer("gadm41_KHM_2.json", "districts.json", (p) => ({
  name: deSmash(p.NAME_2),
  prov: PROV[p.NAME_1] ?? deSmash(p.NAME_1),
}));

console.log("Done.");
