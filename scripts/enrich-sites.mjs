/**
 * Site Data Enrichment Pipeline
 * Enriches investable sites with:
 *   1. Verified coordinates + place_id via Google Places findplacefromtext
 *   2. Elevation via Google Elevation API → elevation_m + flood_risk (< 5m)
 *   3. Port distance via Google Distance Matrix to Sihanoukville Port
 *
 * Usage:
 *   node scripts/enrich-sites.mjs <GOOGLE_API_KEY>
 *
 * Or set env var: GOOGLE_MAPS_KEY=... node scripts/enrich-sites.mjs
 */

const GOOGLE_KEY = process.argv[2] || process.env.GOOGLE_MAPS_KEY || process.env.VITE_GOOGLE_MAPS_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars.");
  process.exit(1);
}

// Sihanoukville Autonomous Port coordinates
const SIHA_PORT = { lat: 10.625, lng: 103.515 };

// Delay helper to respect rate limits
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// 1. Find place from text — returns { lat, lng, place_id, verified }
async function findPlace(name, province) {
  const query = `${name} ${province} Cambodia`;
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=geometry,place_id,name,types&key=${GOOGLE_KEY}`;
  const data = await fetchJson(url);

  if (data.status !== "OK" || !data.candidates?.length) return null;
  const c = data.candidates[0];
  return {
    lat: c.geometry.location.lat,
    lng: c.geometry.location.lng,
    place_id: c.place_id,
  };
}

// 2. Get elevation in metres
async function getElevation(lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${GOOGLE_KEY}`;
  const data = await fetchJson(url);
  if (data.status !== "OK" || !data.results?.length) return null;
  return Math.round(data.results[0].elevation * 10) / 10; // 1 decimal
}

// 3. Distance Matrix — driving distance to Sihanoukville Port
async function getPortDistance(lat, lng) {
  const origin = `${lat},${lng}`;
  const dest = `${SIHA_PORT.lat},${SIHA_PORT.lng}`;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${dest}&mode=driving&key=${GOOGLE_KEY}`;
  const data = await fetchJson(url);
  if (data.status !== "OK") return null;
  const el = data.rows?.[0]?.elements?.[0];
  if (el?.status !== "OK") return null;
  return {
    distance_km: Math.round(el.distance.value / 100) / 10,  // metres → km, 1 decimal
    duration_min: Math.round(el.duration.value / 60),         // seconds → minutes
  };
}

// Update a site row in Supabase via REST
async function updateSite(id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sites?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase PATCH failed for ${id}: ${res.status} ${text}`);
  }
}

async function main() {
  if (!GOOGLE_KEY) {
    console.error("❌ No Google API key. Pass it as: node enrich-sites.mjs YOUR_KEY");
    process.exit(1);
  }

  // Load sites from Supabase
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sites?kind=in.(sez,park,factory,logistics,port,airport)&select=id,name,kind,province,lat,lng&order=name`,
    { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
  );
  const sites = await res.json();
  console.log(`\n📦 Loaded ${sites.length} investable sites from Supabase\n`);

  const results = { updated: 0, skipped: 0, errors: [] };

  for (const site of sites) {
    process.stdout.write(`[${site.id}] ${site.name} ... `);

    try {
      const patch = {};

      // --- Step 1: Places — verify coords + place_id ---
      const place = await findPlace(site.name, site.province);
      await delay(120); // stay under 10 req/s

      if (place) {
        const origLat = Number(site.lat);
        const origLng = Number(site.lng);
        const dLat = Math.abs(place.lat - origLat);
        const dLng = Math.abs(place.lng - origLng);
        const moved = dLat > 0.05 || dLng > 0.05; // >~5km

        patch.place_id = place.place_id;
        patch.coord_verified = true;

        if (moved) {
          patch.lat = place.lat;
          patch.lng = place.lng;
          process.stdout.write(`📍moved(${place.lat.toFixed(4)},${place.lng.toFixed(4)}) `);
        } else {
          process.stdout.write(`✅coords `);
        }

        // Use verified coords for subsequent calls
        site.lat = place.lat;
        site.lng = place.lng;
      } else {
        process.stdout.write(`⚠️no-place `);
      }

      // --- Step 2: Elevation ---
      const elev = await getElevation(Number(site.lat), Number(site.lng));
      await delay(120);

      if (elev !== null) {
        patch.elevation_m = elev;
        patch.flood_risk = elev < 5; // boolean: true = high flood risk
        process.stdout.write(`⛰${elev}m(flood:${patch.flood_risk}) `);
      }

      // --- Step 3: Port Distance ---
      const port = await getPortDistance(Number(site.lat), Number(site.lng));
      await delay(120);

      if (port) {
        patch.port_distance_km = port.distance_km;
        patch.port_time_min = port.duration_min;
        process.stdout.write(`🚢${port.distance_km}km/${port.duration_min}min `);
      }

      // --- Write to Supabase ---
      if (Object.keys(patch).length > 0) {
        await updateSite(site.id, patch);
        results.updated++;
        console.log("→ saved");
      } else {
        results.skipped++;
        console.log("→ no data");
      }

    } catch (err) {
      results.errors.push({ id: site.id, error: err.message });
      console.log(`❌ ${err.message}`);
    }

    await delay(200); // extra breathing room between sites
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅ Updated:  ${results.updated} sites`);
  console.log(`⏭  Skipped:  ${results.skipped} sites`);
  console.log(`❌ Errors:   ${results.errors.length}`);
  if (results.errors.length) {
    results.errors.forEach(e => console.log(`   ${e.id}: ${e.error}`));
  }
  console.log(`${"─".repeat(60)}\n`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
