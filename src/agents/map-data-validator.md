# Map Data Validator Agent — TheGentryLab

## Purpose
Validate and enrich every site in `src/data/platform.ts` against authoritative sources.
Run monthly or whenever new sites are added.

---

## Step 1 — Load current site list

Read `src/data/platform.ts`. Extract the array of sites from `export const SITES: MapSite[]`.
For each site, record: `{ id, name, kind, province, lat, lng }`.

---

## Step 2 — Coordinate validation (per site)

For EVERY site, run two validation approaches:

### 2a. Nominatim (OpenStreetMap — free, no key)
```
GET https://nominatim.openstreetmap.org/search
  ?q={site.name} {site.province} Cambodia
  &countrycodes=kh
  &format=json
  &limit=1
User-Agent: TheGentryLab-MapAgent/1.0
```
Wait **1.1 seconds between requests** (Nominatim rate limit).

Extract: `lat`, `lon`, `display_name` from first result.

Calculate distance (Haversine) between stored vs found coordinates.

### 2b. Google Maps Geocoding API (if VITE_GOOGLE_MAPS_KEY is set)
```
GET https://maps.googleapis.com/maps/api/geocode/json
  ?address={site.name}+{site.province}+Cambodia
  &key={VITE_GOOGLE_MAPS_KEY}
```
Extract: `geometry.location.lat`, `geometry.location.lng`, `formatted_address`.

### 2c. Open Development Cambodia (ODC) cross-reference
Search: `https://opendevelopmentcambodia.net/profiles/special-economic-zones/`
Look for exact name match. Extract coordinates from map embed if found.

---

## Step 3 — Flag rules

| Distance | Action |
|---|---|
| < 1 km | ✅ PASS — no change needed |
| 1–5 km | ⚠️ REVIEW — log for human check |
| > 5 km | ❌ WRONG — auto-correct with verified source |

For **❌ WRONG** sites:
- Use Google Maps result as primary if available (higher accuracy for named places)
- Fall back to Nominatim if no Google Maps key
- Write corrected `lat`/`lng` to `src/data/platform.ts`
- Add a comment: `// Coord verified {DATE} via {SOURCE}`

---

## Step 4 — Data enrichment (per site missing `notes`)

For sites with `notes` undefined or under 80 characters:

1. **Search**: `{site.name} Cambodia {site.kind} investment`
   - Sources: khmertimeskh.com, phnompenhpost.com, cambodiainvestmentreview.com, cdc.gov.kh, opendevelopmentcambodia.net
   
2. **Extract** (from top 3 results):
   - Operational status (Operational / Under Construction / Planned)
   - Total area in hectares
   - Developer/operator name and country of origin
   - Key tenants or industries
   - Utility infrastructure (power kV, water capacity)
   - Road access and distance to nearest port/city
   - Any recent news (expansion, new tenants, issues)

3. **Write** enriched `notes` (2–4 sentences, factual, no marketing language).

4. **Update** `status`, `size`, `utilities`, `road` fields if better data found.

---

## Step 5 — Image URL sourcing (per site missing `image_url`)

For each site:
1. WebFetch the official SEZ/park website if known (e.g., ppsez.com/en)
2. Extract `<meta property="og:image">` content
3. Alternatively, search for news article with aerial/satellite photo:
   - Query: `{site.name} Cambodia aerial photo site:khmertimeskh.com OR site:cambodiainvestmentreview.com`
4. Store the first reliable, publicly accessible image URL as `image_url`

**Quality criteria for images:**
- Must be a direct image URL (ends in .jpg/.png/.webp or is a CDN URL)
- Must be accessible without authentication
- Prefer aerial/overview shots over interior factory shots
- Minimum resolution: 400px wide

---

## Step 6 — Corridor validation

For each corridor in `CORRIDORS`, validate the first and last waypoint:

1. Geocode the corridor start city (e.g., "Phnom Penh") — confirm first waypoint is within 3km
2. Geocode the corridor end city/border (e.g., "Bavet border crossing Cambodia Vietnam") — confirm last waypoint within 3km
3. If end point is wrong, fetch corrected route from OSRM:
   ```
   GET https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
     ?overview=full&geometries=geojson
   ```
   Apply RDP simplification (ε = 0.001°) and update waypoints array.

---

## Step 7 — Output

### Changes to apply to `src/data/platform.ts`:
- Updated `lat`/`lng` with verification comments for all ❌ WRONG sites
- Enriched `notes` for sparse sites
- New `image_url` where found
- Updated `status`/`size` where better data found

### Report to write to `src/agents/last-validation-report.md`:
```markdown
# Validation Report — {DATE}

## Summary
- Sites checked: {N}
- Coordinates corrected: {N}
- Notes enriched: {N}
- Images added: {N}

## Corrections
| Site ID | Old Coords | New Coords | Source | Distance |
|---------|-----------|-----------|--------|----------|

## Enrichments
| Site ID | Fields updated |

## Flagged for Manual Review
| Site ID | Issue |
```

---

## Validation Sources Priority

1. **Google Maps Places API** — most accurate for named industrial zones (requires key)
2. **Nominatim / OpenStreetMap** — free, good for major sites, Cambodia coverage improving
3. **Open Development Cambodia (ODC)** — `opendevelopmentcambodia.net` — best for SEZ GIS data
4. **CDC Cambodia** — `cdc.gov.kh/sez-smart-search/` — official government SEZ registry
5. **SEZB** — `sezb.gov.kh` — SEZ Board official register
6. **Khmer Times / PP Post** — for recent coordinates in news articles
7. **Wikidata** — structured data with coordinates for major infrastructure

## Province centroid fallback table (use when no specific data found)
```
Phnom Penh:      11.5564, 104.9282
Kandal:          11.2833, 104.9500
Kampong Speu:    11.4533, 104.5209
Preah Sihanouk:  10.6167, 103.5167
Svay Rieng:      11.0883, 105.7993
Kampong Cham:    11.9931, 105.4636
Kampong Thom:    12.7111, 104.8889
Siem Reap:       13.3671, 103.8448
Battambang:      13.0957, 103.2022
Banteay Meanchey:13.5860, 102.9830
Kampot:          10.6042, 104.1800
Takeo:           10.9920, 104.7907
Pursat:          12.5388, 103.9193
Kampong Chhnang: 12.2508, 104.6681
```
