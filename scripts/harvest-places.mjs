/**
 * Google Places Harvester
 * Discovers industrial parks, SEZs, factories across Cambodia
 * Searches province-by-province × keyword to maximise coverage
 *
 * Usage: node scripts/harvest-places.mjs <GOOGLE_API_KEY>
 * Outputs: harvest-results.json (new sites not yet in DB)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
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

if (!GOOGLE_KEY) { console.error('❌ No Google API key'); process.exit(1); }
if (!SUPABASE_URL) { console.error('❌ Missing VITE_SUPABASE_URL'); process.exit(1); }

const delay = ms => new Promise(r => setTimeout(r, ms));

// Cambodia province centroids for tiled search
const PROVINCES = [
  { name: 'Phnom Penh',       lat: 11.5564, lng: 104.9282 },
  { name: 'Kandal',           lat: 11.2833, lng: 104.9500 },
  { name: 'Kampong Speu',     lat: 11.4500, lng: 104.5200 },
  { name: 'Preah Sihanouk',   lat: 10.6167, lng: 103.5167 },
  { name: 'Svay Rieng',       lat: 11.0833, lng: 105.8000 },
  { name: 'Kampong Cham',     lat: 11.9931, lng: 105.4636 },
  { name: 'Kampot',           lat: 10.5933, lng: 104.1667 },
  { name: 'Koh Kong',         lat: 11.6167, lng: 103.0000 },
  { name: 'Banteay Meanchey', lat: 13.5833, lng: 102.9833 },
  { name: 'Siem Reap',        lat: 13.3622, lng: 103.8597 },
  { name: 'Takeo',            lat: 10.9833, lng: 104.7833 },
  { name: 'Kampong Chhnang',  lat: 12.2500, lng: 104.6667 },
  { name: 'Kampong Thom',     lat: 12.7119, lng: 104.8882 },
  { name: 'Pursat',           lat: 12.5386, lng: 103.9192 },
  { name: 'Battambang',       lat: 13.0957, lng: 103.2022 },
  { name: 'Prey Veng',        lat: 11.4833, lng: 105.3167 },
  { name: 'Kratié',           lat: 12.4833, lng: 106.0167 },
  { name: 'Stung Treng',      lat: 13.5232, lng: 105.9699 },
  { name: 'Preah Vihear',     lat: 13.7867, lng: 104.9730 },
  { name: 'Oddar Meanchey',   lat: 14.1800, lng: 103.5200 },
  { name: 'Ratanakiri',       lat: 13.7300, lng: 107.0050 },
  { name: 'Mondulkiri',       lat: 12.4564, lng: 107.1878 },
  { name: 'Pailin',           lat: 12.8493, lng: 102.6098 },
  { name: 'Kep',              lat: 10.4833, lng: 104.3000 },
  { name: 'Tboung Khmum',     lat: 11.9000, lng: 105.6500 },
];

const KEYWORDS = [
  'industrial park Cambodia',
  'special economic zone Cambodia',
  'factory zone Cambodia',
  'logistics park Cambodia',
  'industrial estate Cambodia',
];

// Cambodia bounding box
const CAM = { minLat: 9.5, maxLat: 15.0, minLng: 102.0, maxLng: 108.0 };

function inCambodia(lat, lng) {
  return lat >= CAM.minLat && lat <= CAM.maxLat && lng >= CAM.minLng && lng <= CAM.maxLng;
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

function inferKind(types = [], name = '') {
  const n = name.toLowerCase();
  const t = types.join(' ');
  if (n.includes('sez') || n.includes('special economic zone')) return 'sez';
  if (n.includes('industrial park') || n.includes('industrial estate')) return 'park';
  if (n.includes('logistics') || n.includes('warehouse') || n.includes('depot')) return 'logistics';
  if (n.includes('airport')) return 'airport';
  if (n.includes('port') || n.includes('terminal')) return 'port';
  if (t.includes('airport')) return 'airport';
  return 'park';
}

function inferProvince(address) {
  const provinces = ['Phnom Penh','Kandal','Kampong Speu','Sihanoukville','Preah Sihanouk',
    'Svay Rieng','Kampong Cham','Kampot','Koh Kong','Banteay Meanchey','Siem Reap',
    'Takeo','Kampong Chhnang','Kampong Thom','Pursat','Battambang','Prey Veng',
    'Kratié','Stung Treng','Preah Vihear','Oddar Meanchey','Ratanakiri','Mondulkiri',
    'Pailin','Kep','Tboung Khmum'];
  for (const p of provinces) {
    if (address?.includes(p)) return p;
  }
  return 'Cambodia';
}

async function textSearch(query, lat, lng) {
  const location = `${lat},${lng}`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${location}&radius=80000&region=kh&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.warn(`  ⚠️  API status: ${data.status}`);
  }
  return data.results || [];
}

async function getPlaceDetails(place_id) {
  const fields = 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,photos,geometry,types';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result || null;
}

async function main() {
  // Load existing place_ids from Supabase to avoid duplicates
  console.log('\n📋 Loading existing sites from Supabase...');
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sites?select=id,name,place_id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const existing = await existingRes.json();
  const existingPlaceIds = new Set(existing.map(s => s.place_id).filter(Boolean));
  const existingNames = new Set(existing.map(s => s.name.toLowerCase()));
  // Normalised name tokens for fuzzy dedup (removes punctuation, common words)
  function normName(n) {
    return n.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\b(special economic zone|industrial park|sez|co ltd|co\.|ltd|the|a|an)\b/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  const existingNormNames = new Set(existing.map(s => normName(s.name)));
  console.log(`  Found ${existing.length} existing sites, ${existingPlaceIds.size} with place_ids\n`);

  const discovered = new Map(); // place_id → result

  // Search province × keyword
  for (const province of PROVINCES) {
    process.stdout.write(`\n🗺  ${province.name}\n`);

    for (const keyword of KEYWORDS) {
      process.stdout.write(`   🔍 "${keyword}" ... `);

      try {
        const results = await textSearch(keyword, province.lat, province.lng);
        await delay(200);

        let newCount = 0;
        for (const r of results) {
          const { lat, lng } = r.geometry.location;
          if (!inCambodia(lat, lng)) continue;
          if (existingPlaceIds.has(r.place_id)) continue;
          if (discovered.has(r.place_id)) continue;

          discovered.set(r.place_id, {
            place_id: r.place_id,
            name: r.name,
            lat,
            lng,
            address: r.formatted_address,
            rating: r.rating || null,
            review_count: r.user_ratings_total || null,
            photo_reference: r.photos?.[0]?.photo_reference || null,
            types: r.types || [],
          });
          newCount++;
        }
        process.stdout.write(`${results.length} results, ${newCount} new\n`);
      } catch (err) {
        process.stdout.write(`❌ ${err.message}\n`);
      }

      await delay(300);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Discovered ${discovered.size} new unique sites`);
  console.log(`   Fetching place details for each...\n`);

  // Enrich with place details
  const enriched = [];
  let i = 0;
  for (const [place_id, site] of discovered) {
    i++;
    process.stdout.write(`[${i}/${discovered.size}] ${site.name} ... `);

    try {
      const details = await getPlaceDetails(place_id);
      await delay(150);

      if (details) {
        site.website = details.website || null;
        site.phone = details.formatted_phone_number || null;
        site.rating = details.rating || site.rating;
        site.review_count = details.user_ratings_total || site.review_count;
        site.photo_reference = details.photos?.[0]?.photo_reference || site.photo_reference;
        site.address = details.formatted_address || site.address;
      }

      const province = inferProvince(site.address);
      const kind = inferKind(site.types, site.name);
      const id = slugify(site.name);

      // Skip if name too similar to existing (exact or normalised match)
      if (existingNames.has(site.name.toLowerCase()) || existingNormNames.has(normName(site.name))) {
        process.stdout.write(`⏭  already exists by name\n`);
        continue;
      }

      // Use satellite aerial view instead of Places user photos (which may be irrelevant)
      const photo_url = `https://maps.googleapis.com/maps/api/staticmap?center=${site.lat},${site.lng}&zoom=15&size=800x450&maptype=satellite&key=${GOOGLE_KEY}`;

      enriched.push({
        id,
        name: site.name,
        kind,
        layer: 'investment',
        province,
        lat: site.lat,
        lng: site.lng,
        place_id: site.place_id,
        coord_verified: true,
        source: 'google_places',
        google_rating: site.rating,
        google_review_count: site.review_count,
        website: site.website,
        phone: site.phone,
        image_url: photo_url,
        address: site.address,
        last_harvested_at: new Date().toISOString(),
      });

      process.stdout.write(`✅ ${kind} / ${province}\n`);
    } catch (err) {
      process.stdout.write(`❌ ${err.message}\n`);
    }

    await delay(200);
  }

  // Write output file for MCP insertion
  const outPath = resolve(__dir, '../harvest-results.json');
  writeFileSync(outPath, JSON.stringify(enriched, null, 2));

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📦 ${enriched.length} sites ready for insertion`);
  console.log(`📄 Written to: harvest-results.json`);
  console.log(`\nKind breakdown:`);
  const kinds = enriched.reduce((acc, s) => { acc[s.kind] = (acc[s.kind]||0)+1; return acc; }, {});
  Object.entries(kinds).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`   ${k}: ${v}`));
  console.log(`\nProvince breakdown:`);
  const provs = enriched.reduce((acc, s) => { acc[s.province] = (acc[s.province]||0)+1; return acc; }, {});
  Object.entries(provs).sort((a,b)=>b[1]-a[1]).forEach(([p,v]) => console.log(`   ${p}: ${v}`));
  console.log(`${'─'.repeat(60)}\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
