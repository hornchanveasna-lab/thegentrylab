# Map Data Validator & Enrichment Agent — TheGentryLab

## Purpose
Run monthly. For every site in Supabase `sites` table:
1. Validate / correct coordinates (Nominatim + Google Places)
2. Find and store hero photos (OG images from news + official sites)
3. Calculate road distance + travel time to nearest port (Google Distance Matrix API)
4. Calculate ground elevation + flood risk flag (Google Elevation API)
5. Calculate logistics connectivity matrix — Port, Airport, Rail, Border (Haversine SQL)
6. Enrich sparse notes/data from web sources

All results written to Supabase `sites` table via MCP.

## Supabase connection
- **Project ID:** `mcxfukjopdnouicwacbn`
- **MCP:** `mcp__2d9cdc4d-820f-40d1-b353-d5b5fe2deb29`

## Google API key
`VITE_GOOGLE_MAPS_KEY` — stored as Supabase Edge Function secret. Use for Distance Matrix, Elevation, Places, Geocoding calls.

---

## Reference infrastructure points

### Ports (3)
```
Sihanoukville / APSEZ:  10.6167, 103.5167   ← primary deep-sea export port
Phnom Penh Port:        11.5625, 104.9311   ← river port, east/north sites
Koh Kong Port:          11.6236, 102.9837   ← west coast, Koh Kong / Cardamom sites
```

### Airports (4)
```
KTI  Techo International (new Phnom Penh):  11.3589, 104.9335   ← opened 2025
SAI  Siem Reap Angkor Intl. (new):          13.3762, 104.2201   ← opened Nov 2023
KOS  Sihanoukville Intl.:                   10.5797, 103.6368
BBM  Battambang:                            13.0956, 103.2242
```
> **IMPORTANT:** KTI and SAI are the NEW airports. Old PNH (11.546, 104.848) and old REP (13.40, 103.81) are closed/decommissioned — never use those coordinates.

### Rail stations (7 — Cambodia's limited network)
```
Phnom Penh Station:      11.5689, 104.9281
Takeo Station:           10.9824, 104.7965
Kampot Station:          10.6122, 104.1725
Sihanoukville Station:   10.6217, 103.5293
Poipet Station:          13.6447, 102.5593
Pursat Station:          12.5394, 103.9157
Battambang Station:      13.0989, 103.1989
```
> Rail coverage is sparse — only Southern Line (Phnom Penh↔Sihanoukville via Kampot/Takeo) and Northern Line (Phnom Penh↔Poipet via Pursat/Battambang) are active. Most sites will show 40–150 km to nearest station.

### Border crossings (12 — major freight crossings only)
```
Poipet / Aranyaprathet (TH):    13.6519, 102.5664
Cham Yeam / Hat Lek (TH):       11.7033, 102.8894
O'Smach / Chong Jom (TH):       14.1611, 103.0761
Psar Pruhm / Ban Pakard (TH):   12.5497, 102.5572
Bavet / Moc Bai (VN):           11.0768, 106.1098
Prek Chak / Xa Xia (VN):        10.4614, 104.0217
Phnom Den / Tinh Bien (VN):     10.5083, 104.9472
Kaam Samnor / Vinh Xuong (VN):  11.1619, 105.2153
Trapang Sre / Loc Ninh (VN):    11.8489, 106.5806
Trapang Phlong / Xa Mat (VN):   11.8600, 106.0269
Veun Kham / Don Kralor (LA):    13.9867, 105.8278
O'Yadav / Le Thanh (VN):        13.7500, 107.5333
```

---

## Step 1 — Load all sites from Supabase

```sql
SELECT
  id, name, kind, layer, province, lat, lng,
  image_url, coord_verified, place_id,
  port_distance_km, port_time_min,
  airport_distance_km, nearest_airport,
  rail_distance_km, nearest_rail,
  border_distance_km, nearest_border,
  nearest_port,
  elevation_m, flood_risk,
  notes, status, size, utilities, road
FROM sites
ORDER BY id;
```

Process all rows. Steps 2–5 run per site.

---

## Step 2 — Coordinate validation

For EVERY site, geocode and calculate Haversine distance vs. stored coords.

### 2a. Nominatim (free, no key)
```
GET https://nominatim.openstreetmap.org/search
  ?q={site.name} {site.province} Cambodia
  &countrycodes=kh&format=json&limit=1
User-Agent: TheGentryLab-MapAgent/1.0
```
Wait **1.1 seconds between requests** (Nominatim rate limit).

### 2b. Google Maps Geocoding (if key set)
```
GET https://maps.googleapis.com/maps/api/geocode/json
  ?address={site.name}+{site.province}+Cambodia
  &key={VITE_GOOGLE_MAPS_KEY}
```

### Flag rules
| Distance | Action |
|---|---|
| < 1 km | ✅ PASS |
| 1–5 km | ⚠️ REVIEW — log but do not auto-fix |
| > 5 km | ❌ AUTO-FIX — update lat/lng from verified source |

---

## Step 3 — Distance Matrix (Google) — port road distance + travel time

Run for EVERY site where `port_distance_km IS NULL`.

### Determine nearest port (road distance via Distance Matrix)
Calculate to all 3 ports, pick shortest road distance:
- Sihanoukville / APSEZ: 10.6167, 103.5167
- Phnom Penh Port: 11.5625, 104.9311
- Koh Kong Port: 11.6236, 102.9837

```
GET https://maps.googleapis.com/maps/api/distancematrix/json
  ?origins={site.lat},{site.lng}
  &destinations=10.6167,103.5167|11.5625,104.9311|11.6236,102.9837
  &mode=driving
  &key={VITE_GOOGLE_MAPS_KEY}
```

Extract:
```
distances = [elem.distance.value / 1000 for elem in response.rows[0].elements]
durations = [elem.duration.value / 60   for elem in response.rows[0].elements]
port_names = ['Sihanoukville Port', 'Phnom Penh Port', 'Koh Kong Port']

idx = distances.index(min(distances))
port_distance_km = distances[idx]
port_time_min    = durations[idx]
nearest_port     = port_names[idx]
```

Write to Supabase:
```sql
UPDATE sites SET
  port_distance_km = {port_distance_km},
  port_time_min    = {port_time_min},
  nearest_port     = '{nearest_port}',
  updated_at       = NOW()
WHERE id = '{site.id}';
```

Rate limit: wait 0.1 seconds between requests.

---

## Step 4 — Elevation API (Google) — ground elevation + flood risk

Run for EVERY site where `elevation_m IS NULL`.

Batch all eligible sites in one request (pipe-separated, up to 512 locations):
```
GET https://maps.googleapis.com/maps/api/elevation/json
  ?locations={lat1},{lng1}|{lat2},{lng2}|...
  &key={VITE_GOOGLE_MAPS_KEY}
```

Extract + compute:
```
elevation_m = response.results[i].elevation
flood_risk  = elevation_m < 5.0   # < 5m = meaningful flood exposure in Cambodia
```

Write to Supabase:
```sql
UPDATE sites SET
  elevation_m = {elevation_m},
  flood_risk  = {flood_risk},
  updated_at  = NOW()
WHERE id = '{site.id}';
```

---

## Step 5 — Logistics connectivity matrix (Haversine SQL)

Run ONE batch SQL for ALL sites simultaneously using the `haversine_km` PostgreSQL function
(already installed in the DB). This recalculates airport, rail, and border distances for every site
with new or corrected coordinates.

### 5a — Airport distances
```sql
WITH airport_dists AS (
  SELECT
    s.id,
    UNNEST(ARRAY['KTI','SAI','KOS','BBM']) AS acode,
    UNNEST(ARRAY[
      haversine_km(s.lat, s.lng, 11.3589, 104.9335),  -- KTI (Techo, new Phnom Penh)
      haversine_km(s.lat, s.lng, 13.3762, 104.2201),  -- SAI (Siem Reap Angkor, new)
      haversine_km(s.lat, s.lng, 10.5797, 103.6368),  -- KOS (Sihanoukville)
      haversine_km(s.lat, s.lng, 13.0956, 103.2242)   -- BBM (Battambang)
    ]) AS dist
  FROM sites s
),
nearest AS (
  SELECT DISTINCT ON (id) id, acode, dist
  FROM airport_dists
  ORDER BY id, dist
)
UPDATE sites s SET
  airport_distance_km = n.dist,
  nearest_airport     = n.acode
FROM nearest n WHERE s.id = n.id;
```

### 5b — Rail station distances
```sql
WITH rail_dists AS (
  SELECT
    s.id,
    UNNEST(ARRAY[
      'Phnom Penh Stn','Takeo Stn','Kampot Stn','Sihanoukville Stn',
      'Poipet Stn','Pursat Stn','Battambang Stn'
    ]) AS rname,
    UNNEST(ARRAY[
      haversine_km(s.lat, s.lng, 11.5689, 104.9281),  -- Phnom Penh
      haversine_km(s.lat, s.lng, 10.9824, 104.7965),  -- Takeo
      haversine_km(s.lat, s.lng, 10.6122, 104.1725),  -- Kampot
      haversine_km(s.lat, s.lng, 10.6217, 103.5293),  -- Sihanoukville
      haversine_km(s.lat, s.lng, 13.6447, 102.5593),  -- Poipet
      haversine_km(s.lat, s.lng, 12.5394, 103.9157),  -- Pursat
      haversine_km(s.lat, s.lng, 13.0989, 103.1989)   -- Battambang
    ]) AS dist
  FROM sites s
),
nearest AS (
  SELECT DISTINCT ON (id) id, rname, dist
  FROM rail_dists
  ORDER BY id, dist
)
UPDATE sites s SET
  rail_distance_km = n.dist,
  nearest_rail     = n.rname
FROM nearest n WHERE s.id = n.id;
```

### 5c — Border crossing distances
```sql
WITH border_dists AS (
  SELECT
    s.id,
    UNNEST(ARRAY[
      'Poipet/Aranyaprathet (TH)','Cham Yeam/Hat Lek (TH)',
      'O''Smach/Chong Jom (TH)','Psar Pruhm/Ban Pakard (TH)',
      'Bavet/Moc Bai (VN)','Prek Chak/Xa Xia (VN)',
      'Phnom Den/Tinh Bien (VN)','Kaam Samnor/Vinh Xuong (VN)',
      'Trapang Sre/Loc Ninh (VN)','Trapang Phlong/Xa Mat (VN)',
      'Veun Kham/Don Kralor (LA)','O''Yadav/Le Thanh (VN)'
    ]) AS bname,
    UNNEST(ARRAY[
      haversine_km(s.lat, s.lng, 13.6519, 102.5664),  -- Poipet/TH
      haversine_km(s.lat, s.lng, 11.7033, 102.8894),  -- Cham Yeam/TH
      haversine_km(s.lat, s.lng, 14.1611, 103.0761),  -- O'Smach/TH
      haversine_km(s.lat, s.lng, 12.5497, 102.5572),  -- Psar Pruhm/TH
      haversine_km(s.lat, s.lng, 11.0768, 106.1098),  -- Bavet/VN
      haversine_km(s.lat, s.lng, 10.4614, 104.0217),  -- Prek Chak/VN
      haversine_km(s.lat, s.lng, 10.5083, 104.9472),  -- Phnom Den/VN
      haversine_km(s.lat, s.lng, 11.1619, 105.2153),  -- Kaam Samnor/VN
      haversine_km(s.lat, s.lng, 11.8489, 106.5806),  -- Trapang Sre/VN
      haversine_km(s.lat, s.lng, 11.8600, 106.0269),  -- Trapang Phlong/VN
      haversine_km(s.lat, s.lng, 13.9867, 105.8278),  -- Veun Kham/LA
      haversine_km(s.lat, s.lng, 13.7500, 107.5333)   -- O'Yadav/VN
    ]) AS dist
  FROM sites s
),
nearest AS (
  SELECT DISTINCT ON (id) id, bname, dist
  FROM border_dists
  ORDER BY id, dist
)
UPDATE sites s SET
  border_distance_km = n.dist,
  nearest_border     = n.bname
FROM nearest n WHERE s.id = n.id;
```

> Re-run steps 5a–5c whenever any site's coordinates are corrected in Step 2.

---

## Step 6 — Place Details (Google) — verify coord + get place_id + website

Run for EVERY site where `coord_verified = false` AND `place_id IS NULL`.

### Find Place
```
GET https://maps.googleapis.com/maps/api/place/findplacefromtext/json
  ?input={site.name} Cambodia
  &inputtype=textquery
  &fields=place_id,geometry,name
  &locationbias=rectangle:9.5,102.0|15.0,108.0
  &key={VITE_GOOGLE_MAPS_KEY}
```

### Get Place Details
```
GET https://maps.googleapis.com/maps/api/place/details/json
  ?place_id={place_id}
  &fields=name,geometry,formatted_address,website,photo
  &key={VITE_GOOGLE_MAPS_KEY}
```

### Verify
```
if haversine_km < 1.0:   coord_verified = true, keep existing lat/lng
if haversine_km 1–5 km:  coord_verified = true, UPDATE lat/lng to Google result
if haversine_km > 5 km:  flag for manual review, do NOT auto-update
```

Write to Supabase:
```sql
UPDATE sites SET
  place_id       = '{place_id}',
  coord_verified = {true/false},
  lat            = {verified_lat},
  lng            = {verified_lng},
  updated_at     = NOW()
WHERE id = '{site.id}';
```

---

## Step 7 — News image sourcing (run for ALL sites missing `image_url`)

Work through source tiers — stop as soon as a valid image is found for each site.

**Tier 1 — Cambodia-specialist:**
```
thebettercambodia.com: "{site.name}"
cambodiainvestmentreview.com: "{site.name}"
phnompenhpost.com: "{site.name}" Cambodia
```

**Tier 2 — Regional English-language:**
```
asia.nikkei.com: "{site.name}" Cambodia
aseanbriefing.com: "{site.name}" Cambodia
bangkokpost.com: "{site.name}" Cambodia
reuters.com: "{site.name}" Cambodia
```

**Tier 3 — Trade & investment:**
```
investasean.com: "{site.name}" Cambodia
jetro.go.jp: "{site.name}" Cambodia
china-briefing.com: "{site.name}" Cambodia
```

**Tier 4 — Official sites (by kind):**
- SEZ/Parks: operator website from `notes` or `website` field
- Substations: `https://www.edc.com.kh/` — search news/gallery for substation name
- Airports: `https://techo-airport.gov.kh/` (KTI), `https://siemreapairport.com/` (SAI)
- Ports: `https://www.sihanoukvilleport.com.kh/`

> **Skip known-blocked sources:** `khmertimeskh.com` and `cambodianess.com` return HTTP 403.

Extract `<meta property="og:image">`. Verify URL is a direct image (jpg/png/webp) or CDN path.
Write valid URL to `image_url` field in Supabase.

---

## Step 8 — Data enrichment

For sites with `notes` under 100 characters:
1. Search: `{site.name} Cambodia investment {current_year}`
2. Extract from top 3 results: operational status, area, developer, tenants, utilities, road access
3. Write enriched `notes` (2–4 sentences, factual only)
4. Update `status`, `size`, `utilities`, `road` if better data found

---

## Step 9 — Corridor endpoint validation

For each corridor in `CORRIDORS`:
1. Geocode start and end city — confirm waypoints within 3km
2. If wrong, re-fetch from OSRM with RDP smoothing (ε=0.001°):
```
GET https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
  ?overview=full&geometries=geojson
```

---

## Step 10 — Output report

Write `src/agents/last-validation-report.md`:
```markdown
# Validation Report — {DATE}

## Summary
- Sites processed: {N}
- Coordinates corrected: {N}
- Coordinates verified (unchanged): {N}
- Images added: {N}
- Port distances calculated: {N}
- Airport distances recalculated: {N}
- Rail distances recalculated: {N}
- Border distances recalculated: {N}
- Elevation computed: {N}
- Flood risk flagged: {N} (elevation < 5m)
- Notes enriched: {N}

## Logistics Summary — Nearest by Category
| Category | Avg distance km | Closest site | Farthest site |

## Flood Risk Sites (elevation < 5m)
| Site ID | Name | Province | Elevation m |

## Coordinate Corrections
| Site ID | Old Coords | New Coords | Source | Distance km |

## Images Added
| Site ID | Image URL | Source |

## Still Missing Images
| Site ID | Name | Why not found |

## Flagged for Manual Review
| Site ID | Issue |
```

---

## Validation Sources Priority

1. Google Maps Places API (highest accuracy — requires key)
2. Nominatim / OpenStreetMap (free, Cambodia coverage improving)
3. **EDC (Électricité du Cambodge)** — `https://www.edc.com.kh/` — primary for all substation sites
4. Open Development Cambodia — `opendevelopmentcambodia.net/profiles/special-economic-zones/`
5. CDC Cambodia — `cdc.gov.kh/sez-smart-search/`
6. SEZB — `sezb.gov.kh`
7. Khmer Times / PP Post — for article coordinates
8. Wikidata — structured data with coordinates

---

## Province centroid fallback (when no specific data found)
```
Phnom Penh:       11.5564, 104.9282
Kandal:           11.2833, 104.9500
Kampong Speu:     11.4533, 104.5209
Preah Sihanouk:   10.6167, 103.5167
Svay Rieng:       11.0883, 105.7993
Kampong Cham:     11.9931, 105.4636
Kampong Thom:     12.7111, 104.8889
Siem Reap:        13.3671, 103.8448
Battambang:       13.0957, 103.2022
Banteay Meanchey: 13.5860, 102.9830
Kampot:           10.6042, 104.1800
Takeo:            10.9920, 104.7907
Pursat:           12.5388, 103.9193
Kampong Chhnang:  12.2508, 104.6681
Kratié:           12.4833, 106.0167
Stung Treng:      13.5232, 105.9699
Ratanakiri:       13.7300, 107.0050
Mondulkiri:       12.4564, 107.1878
Koh Kong:         11.6167, 103.0000
```

---

## Known tricky sites (extra care required)
- **ISI SEZ**: Trapeang Kou village, Prey Nob district, Preah Sihanouk. Along PP–SVK Expressway ~30 min north of APSEZ port. Coords: 10.7828, 103.7382
- **Techo International Airport (KTI)**: 11.3589, 104.9335 in Kandal — **NOT** old PNH at 11.546, 104.848
- **Siem Reap Angkor Intl. Airport (SAI)**: 13.3762, 104.2201 — **NOT** old REP at 13.40, 103.81
- **Bavet SEZ cluster**: All around 106.10–106.12E — NOT 105.94E
- **Poipet SEZ cluster**: Near Thai border 13.64–13.66N, 102.55–102.57E
- **Koh Kong SEZs**: Neang Kok at 11.593, 103.000 — Koh Kong town, not Koh Kong province centroid
