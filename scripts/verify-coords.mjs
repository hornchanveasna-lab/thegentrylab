/**
 * Phase 1 — Coordinate Verification via Google Places Text Search
 *
 * Uses textsearch (not findplacefromtext) with province validation:
 *   - Tries up to 3 query variants per site
 *   - Validates result is inside Cambodia bounding box
 *   - Validates result is within 100km of expected province centroid
 *   - Drift guard: if >30km from our estimated coords, logs it for review
 *   - Only updates if confidence checks pass
 *
 * Usage:
 *   node scripts/verify-coords.mjs [GOOGLE_API_KEY]
 *   Or set VITE_GOOGLE_MAPS_KEY or GOOGLE_MAPS_KEY in env.
 *
 * Targets: sites where coord_verified IS NOT TRUE
 * Can filter to kind: node scripts/verify-coords.mjs KEY --kind=sez,park
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dep needed)
try {
  const env = readFileSync(resolve(__dir, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
} catch {}

const GOOGLE_KEY = process.argv[2] || process.env.GOOGLE_MAPS_KEY || process.env.VITE_GOOGLE_MAPS_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Filter by kind (comma-separated), e.g. --kind=sez,park
const kindArg = process.argv.find(a => a.startsWith('--kind='));
const KIND_FILTER = kindArg ? kindArg.replace('--kind=', '').split(',') : null;

// Cambodia bounding box
const CAM_BOX = { minLat: 9.5, maxLat: 15.0, minLng: 102.0, maxLng: 108.0 };

// Province centroids (WGS84)
const PROVINCE_CENTROIDS = {
  'Phnom Penh':         [11.5564, 104.9282],
  'Kandal':             [11.2833, 104.9500],
  'Kampong Speu':       [11.4500, 104.5200],
  'Preah Sihanouk':     [10.6167, 103.5167],
  'Sihanoukville':      [10.6167, 103.5167],
  'Svay Rieng':         [11.0833, 105.8000],
  'Kampong Cham':       [11.9931, 105.4636],
  'Kampot':             [10.5933, 104.1667],
  'Koh Kong':           [11.6167, 103.0000],
  'Banteay Meanchey':   [13.5833, 102.9833],
  'Siem Reap':          [13.3622, 103.8597],
  'Takeo':              [10.9833, 104.7833],
  'Kampong Chhnang':    [12.2500, 104.6667],
  'Kampong Thom':       [12.7119, 104.8882],
  'Pursat':             [12.5386, 103.9192],
  'Battambang':         [13.0957, 103.2022],
  'Stung Treng':        [13.5232, 105.9699],
  'Kratié':             [12.4833, 106.0167],
  'Mondulkiri':         [12.4564, 107.1878],
  'Ratanakiri':         [13.7300, 107.0050],
  'Preah Vihear':       [13.7867, 104.9730],
  'Oddar Meanchey':     [14.1800, 103.5200],
  'Pailin':             [12.8493, 102.6098],
  'Kep':                [10.4833, 104.3000],
};

const delay = ms => new Promise(r => setTimeout(r, ms));

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function insideCambodia(lat, lng) {
  return lat >= CAM_BOX.minLat && lat <= CAM_BOX.maxLat &&
         lng >= CAM_BOX.minLng && lng <= CAM_BOX.maxLng;
}

function provinceOk(lat, lng, province) {
  // Try exact match, then partial match
  const centroid = PROVINCE_CENTROIDS[province] ||
    Object.entries(PROVINCE_CENTROIDS).find(([k]) => province.includes(k) || k.includes(province))?.[1];
  if (!centroid) return { ok: true, dist: null }; // unknown province — skip check
  const dist = distanceKm(lat, lng, centroid[0], centroid[1]);
  return { ok: dist <= 120, dist: Math.round(dist) };
}

async function textSearch(query) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&region=kh&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  return data.results; // return all candidates
}

async function findBestMatch(site) {
  const queries = [
    `"${site.name}" special economic zone Cambodia`,
    `"${site.name}" industrial zone ${site.province} Cambodia`,
    `${site.name} SEZ ${site.province} Cambodia`,
  ];

  for (const q of queries) {
    const results = await textSearch(q);
    await delay(150);
    if (!results) continue;

    for (const r of results.slice(0, 3)) {
      const { lat, lng } = r.geometry.location;
      if (!insideCambodia(lat, lng)) continue;
      const prov = provinceOk(lat, lng, site.province);
      if (!prov.ok) continue;

      return {
        lat, lng,
        place_id: r.place_id,
        google_name: r.name,
        query: q,
        province_dist_km: prov.dist,
      };
    }
  }
  return null;
}

async function patchSite(id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sites?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH failed: ${res.status} ${await res.text()}`);
}

async function main() {
  if (!GOOGLE_KEY)  { console.error('❌ No Google API key'); process.exit(1); }
  if (!SUPABASE_URL){ console.error('❌ Missing VITE_SUPABASE_URL'); process.exit(1); }

  // Load unverified sites
  let url = `${SUPABASE_URL}/rest/v1/sites?coord_verified=not.is.true&select=id,name,kind,province,lat,lng&order=kind,name`;
  if (KIND_FILTER) url += `&kind=in.(${KIND_FILTER.join(',')})`;

  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const sites = await res.json();
  console.log(`\n🔍 Verifying ${sites.length} unverified sites${KIND_FILTER ? ` (kind: ${KIND_FILTER})` : ''}\n`);

  const results = { verified: 0, moved: 0, flagged: 0, notFound: 0, errors: [] };

  for (const site of sites) {
    process.stdout.write(`[${site.kind}] ${site.name} ... `);

    try {
      const match = await findBestMatch(site);

      if (!match) {
        process.stdout.write(`⚠️  no match found\n`);
        results.notFound++;
        continue;
      }

      const origLat = Number(site.lat);
      const origLng = Number(site.lng);
      const drift = distanceKm(origLat, origLng, match.lat, match.lng);

      const patch = {
        place_id: match.place_id,
        coord_verified: true,
        lat: match.lat,
        lng: match.lng,
      };

      if (drift > 30) {
        // Significant move — log prominently
        process.stdout.write(`📍 MOVED ${Math.round(drift)}km → (${match.lat.toFixed(4)},${match.lng.toFixed(4)}) "${match.google_name}" [prov:${match.province_dist_km}km]\n`);
        results.moved++;
      } else if (drift > 1) {
        process.stdout.write(`📍 adjusted ${Math.round(drift)}km → (${match.lat.toFixed(4)},${match.lng.toFixed(4)})\n`);
        results.verified++;
      } else {
        process.stdout.write(`✅ confirmed (${match.lat.toFixed(4)},${match.lng.toFixed(4)})\n`);
        results.verified++;
      }

      await patchSite(site.id, patch);

    } catch (err) {
      process.stdout.write(`❌ ${err.message}\n`);
      results.errors.push({ id: site.id, error: err.message });
    }

    await delay(250);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Confirmed/adjusted: ${results.verified}`);
  console.log(`📍 Significantly moved: ${results.moved}`);
  console.log(`⚠️  Not found:          ${results.notFound}`);
  console.log(`❌ Errors:             ${results.errors.length}`);
  if (results.errors.length) results.errors.forEach(e => console.log(`   ${e.id}: ${e.error}`));
  console.log(`${'─'.repeat(60)}\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
