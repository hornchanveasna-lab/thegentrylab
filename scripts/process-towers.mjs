/**
 * OpenCelliD cell-tower processor for TheGentryLab map.
 *
 * Turns the OpenCelliD Cambodia cell export into a slim GeoJSON of tower SITES
 * (deduped from raw sectors) coloured by operator, for the "Cell Towers" layer.
 *
 * Get the data (free): register at https://opencellid.org → API key, then:
 *   curl -o 456.csv.gz "https://opencellid.org/ajax/downloadFile.php?token=YOUR_KEY&file=456.csv.gz"
 *   gunzip 456.csv.gz
 * Drop 456.csv into scripts/geo-incoming/ and run:
 *   node scripts/process-towers.mjs scripts/geo-incoming/456.csv public/geo/towers.json
 *
 * OpenCelliD CSV columns:
 *   radio,mcc,net,area,cell,unit,lon,lat,range,samples,changeable,created,updated,averageSignal
 *
 * Then flip the "towers" layer to available in IndustrialMap.tsx (already wired).
 */

import { readFileSync, writeFileSync } from "fs";

const IN  = process.argv[2] || "scripts/geo-incoming/456.csv";
const OUT = process.argv[3] || "public/geo/towers.json";

// Cambodia MNC → operator (matches coverage-overlay colours)
const OPERATORS = {
  "1":  { op: "cellcard", label: "Cellcard" },
  "6":  { op: "smart",    label: "Smart" },
  "8":  { op: "metfone",  label: "Metfone" },
};

const round = (n) => Math.round(n * 1e3) / 1e3;   // ~110 m site dedup

const csv = readFileSync(IN, "utf8").split(/\r?\n/);
const seen = new Set();
const features = [];
const counts = { cellcard: 0, smart: 0, metfone: 0 };

for (let i = 1; i < csv.length; i++) {
  const line = csv[i];
  if (!line) continue;
  const f = line.split(",");
  const mcc = f[1], net = f[2], lon = parseFloat(f[6]), lat = parseFloat(f[7]);
  if (mcc !== "456") continue;
  const meta = OPERATORS[net];
  if (!meta) continue;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
  const rlon = round(lon), rlat = round(lat);
  const key = `${meta.op}:${rlat}:${rlon}`;       // dedup sectors → tower sites
  if (seen.has(key)) continue;
  seen.add(key);
  counts[meta.op]++;
  features.push({
    type: "Feature",
    properties: { op: meta.op },
    geometry: { type: "Point", coordinates: [rlon, rlat] },
  });
}

const json = JSON.stringify({ type: "FeatureCollection", features });
writeFileSync(OUT, json);
console.log(`✓ ${OUT}: ${features.length} tower sites, ${(json.length / 1024).toFixed(0)} KB`);
console.log(`  Cellcard ${counts.cellcard} · Smart ${counts.smart} · Metfone ${counts.metfone}`);
