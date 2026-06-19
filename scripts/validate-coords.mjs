/**
 * validate-coords.mjs
 *
 * Validates every site in platform.ts against Google Places API.
 * Reports: wrong coordinates, name mismatches, sites not found on Google.
 *
 * Usage:
 *   node scripts/validate-coords.mjs --key YOUR_GOOGLE_API_KEY
 *
 * Or set env var:
 *   GOOGLE_API_KEY=xxx node scripts/validate-coords.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { argv } from "process";

// ── Config ────────────────────────────────────────────────────────────────────
const KEY = process.env.GOOGLE_API_KEY ?? argv[argv.indexOf("--key") + 1];
if (!KEY || KEY === "undefined") {
  console.error("❌  No API key. Set GOOGLE_API_KEY env var or pass --key YOUR_KEY");
  process.exit(1);
}

// Distance threshold in metres — flag if Google result is further than this
const WARN_DISTANCE_M = 500;
const ERROR_DISTANCE_M = 2000;

// ── Inline site list (mirrors platform.ts — update if you add sites) ──────────
// We read it as text and parse the lat/lng/id/name/coordVerified fields.
// This avoids needing ts-node.
const PLATFORM_PATH = new URL("../src/data/platform.ts", import.meta.url).pathname;

function parseSites(src) {
  const sites = [];
  // Match each { id: "...", name: "...", ... lat: X, lng: Y, ... coordVerified: true/false }
  const blocks = src.split(/\n  \{/).slice(1);
  for (const block of blocks) {
    const id    = block.match(/id:\s*"([^"]+)"/)?.[1];
    const name  = block.match(/name:\s*"([^"]+)"/)?.[1];
    const lat   = parseFloat(block.match(/\blat:\s*([\d.-]+)/)?.[1]);
    const lng   = parseFloat(block.match(/\blng:\s*([\d.-]+)/)?.[1]);
    const province = block.match(/province:\s*"([^"]+)"/)?.[1] ?? "";
    const verified = /coordVerified:\s*true/.test(block);
    if (id && name && !isNaN(lat) && !isNaN(lng)) {
      sites.push({ id, name, lat, lng, province, coordVerified: verified });
    }
  }
  return sites;
}

// ── Haversine distance (metres) ───────────────────────────────────────────────
function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Google Places Text Search ─────────────────────────────────────────────────
async function searchPlace(name, province) {
  const query = `${name} ${province} Cambodia`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) return null;
  const r = data.results[0];
  return {
    googleName:    r.name,
    googleAddress: r.formatted_address,
    lat:           r.geometry.location.lat,
    lng:           r.geometry.location.lng,
    placeId:       r.place_id,
    mapsUrl:       `https://www.google.com/maps/place/?q=place_id:${r.place_id}`,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
const src   = readFileSync(decodeURIComponent(PLATFORM_PATH.replace(/^\/([A-Z]:)/, "$1")), "utf8");
const sites = parseSites(src);

console.log(`\n🗺  Validating ${sites.length} sites against Google Places API…\n`);

const results = { ok: [], warn: [], error: [], notFound: [] };

for (const site of sites) {
  await new Promise(r => setTimeout(r, 120)); // ~8 req/s — stay under free quota
  const g = await searchPlace(site.name, site.province);

  if (!g) {
    results.notFound.push({ ...site, note: "Not found on Google Places" });
    console.log(`❓  NOT FOUND   ${site.name}`);
    continue;
  }

  const dist = Math.round(distanceM(site.lat, site.lng, g.lat, g.lng));
  const entry = {
    id:             site.id,
    name:           site.name,
    coordVerified:  site.coordVerified,
    currentLat:     site.lat,
    currentLng:     site.lng,
    googleLat:      g.lat,
    googleLng:      g.lng,
    distanceM:      dist,
    googleName:     g.googleName,
    googleAddress:  g.googleAddress,
    mapsUrl:        g.mapsUrl,
  };

  if (dist > ERROR_DISTANCE_M) {
    results.error.push(entry);
    console.log(`🔴  ERROR  ${dist}m off   ${site.name}  →  "${g.googleName}" (${g.googleAddress})`);
  } else if (dist > WARN_DISTANCE_M) {
    results.warn.push(entry);
    console.log(`🟡  WARN   ${dist}m off   ${site.name}  →  "${g.googleName}"`);
  } else {
    results.ok.push(entry);
    console.log(`✅  OK     ${dist}m       ${site.name}`);
  }

  // Flag if Google's name is very different (possible wrong site)
  const nameSim = site.name.toLowerCase().split(" ").filter(w => w.length > 3)
    .filter(w => g.googleName.toLowerCase().includes(w)).length;
  if (nameSim === 0 && dist > 100) {
    console.log(`   ⚠️  NAME MISMATCH: our="${site.name}" google="${g.googleName}"`);
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
const report = {
  generated: new Date().toISOString(),
  summary: {
    total:    sites.length,
    ok:       results.ok.length,
    warn:     results.warn.length,
    error:    results.error.length,
    notFound: results.notFound.length,
  },
  errors:   results.error,
  warnings: results.warn,
  notFound: results.notFound,
  ok:       results.ok,
};

const outPath = "scripts/coord-validation-report.json";
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
  ✅ OK (< ${WARN_DISTANCE_M}m):        ${results.ok.length}
  🟡 Warn (${WARN_DISTANCE_M}–${ERROR_DISTANCE_M}m):  ${results.warn.length}
  🔴 Error (> ${ERROR_DISTANCE_M}m):    ${results.error.length}
  ❓ Not found:         ${results.notFound.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Report saved to: ${outPath}

NEXT STEPS:
  1. Review errors + not-found sites — these need manual correction or removal
  2. Share the report JSON and I will apply all fixes to platform.ts automatically
`);
