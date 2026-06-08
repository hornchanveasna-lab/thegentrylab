# ODC Map Harvester — TheGentryLab

## Schedule
1st of each month at 08:30 ICT (01:30 UTC) — runs after odc-map-harvester, independent of tracker-updater

## Purpose
Harvest structured geospatial data from Open Development Cambodia (ODC) CKAN API. Populate and maintain the Supabase `sites` table with comprehensive Cambodia industrial map data across all 6 layers: investment, infrastructure, utilities, risk, labor, corridors.

ODC is the most authoritative open-data source for Cambodia geospatial data. It holds GeoJSON datasets for universities, schools/TVET, economic zones, electricity coverage, protected areas, roads, water infrastructure, and population. This agent systematically fetches those datasets, maps each feature to the MapSite schema, deduplicates against existing rows, and inserts only new or changed sites.

---

## Supabase Connection
- **Project ID:** `mcxfukjopdnouicwacbn`
- **Table:** `sites`
- **MCP tool:** Supabase MCP → `execute_sql`

---

## MapSite Schema (target table: `sites`)

| Column | Type | Required | Values / Notes |
|--------|------|----------|----------------|
| `id` | text | ✅ | slug: `odc-{kind}-{province-slug}-{name-slug}` e.g. `odc-university-phnom-penh-itc` |
| `name` | text | ✅ | Full English name |
| `kind` | text | ✅ | `sez` `park` `factory` `logistics` `port` `airport` `substation` `university` `tvet` `corridor` |
| `layer` | text | ✅ | `investment` `infrastructure` `utilities` `risk` `labor` `corridors` |
| `province` | text | ✅ | Cambodia province name |
| `lat` | numeric | ✅ | Decimal degrees WGS84 |
| `lng` | numeric | ✅ | Decimal degrees WGS84 |
| `size` | text | — | Area string e.g. "120 ha" |
| `status` | text | — | `Operational` `Under Construction` `Planned` |
| `utilities` | text | — | Power/water supply details |
| `road` | text | — | Nearest national road |
| `notes` | text | — | 1-sentence factual description |
| `score` | integer | — | 0–100 suitability score (investment layer only) |
| `strengths` | text[] | — | Up to 4 bullet points (investment layer only) |
| `constraints` | text[] | — | Up to 3 constraints |
| `target_industries` | text[] | — | Relevant sectors |
| `recommendation` | text | — | 1-sentence advisory (investment layer only) |

---

## Data Source: ODC CKAN API

Base URL: `https://data.opendevelopmentcambodia.net/api/3/action/`

Standard endpoints:
- `package_search?q={query}&fq=odm_spatial_range_list:kh&rows=20&sort=metadata_modified+desc`
- `package_show?id={dataset_id}` → get resource download URLs
- Direct GeoJSON download via resource URL

---

## Step-by-Step Execution

### STEP 1 — Fetch recently updated ODC datasets

Call the ODC CKAN search API for datasets modified in the last 60 days across all target categories. Run these 6 searches:

```
GET https://data.opendevelopmentcambodia.net/api/3/action/package_search?q=university&fq=odm_spatial_range_list:kh&rows=10&sort=metadata_modified+desc

GET https://data.opendevelopmentcambodia.net/api/3/action/package_search?q=school+tvet+vocational&fq=odm_spatial_range_list:kh&rows=10&sort=metadata_modified+desc

GET https://data.opendevelopmentcambodia.net/api/3/action/package_search?q=economic+zone+industrial&fq=odm_spatial_range_list:kh&rows=10&sort=metadata_modified+desc

GET https://data.opendevelopmentcambodia.net/api/3/action/package_search?q=electricity+power+substation+EDC&fq=odm_spatial_range_list:kh&rows=10&sort=metadata_modified+desc

GET https://data.opendevelopmentcambodia.net/api/3/action/package_search?q=protected+area+forest+flood&fq=odm_spatial_range_list:kh&rows=10&sort=metadata_modified+desc

GET https://data.opendevelopmentcambodia.net/api/3/action/package_search?q=road+highway+expressway+port+airport&fq=odm_spatial_range_list:kh&rows=10&sort=metadata_modified+desc
```

For each result, note:
- `id` (dataset slug)
- `metadata_modified` date
- `resources` array — find the resource with format `GeoJSON` or `JSON` or `CSV` (prefer GeoJSON)

---

### STEP 2 — Priority datasets to ALWAYS process (regardless of modification date)

These known ODC datasets are the backbone. Process them every run to catch any new features:

| Category | Dataset ID / Search Term | Layer | Kind | GeoJSON URL (known) |
|----------|--------------------------|-------|------|---------------------|
| Universities | `public-universities-of-cambodia` | labor | university | `https://data.opendevelopmentcambodia.net/en/dataset/ba29bd88-0bce-442b-89ce-d73c958c02f3/resource/6005d745-d86d-4b43-9a5d-83b81ca8ee79/download/public_universities.geojson` |
| Schools/TVET | `school-of-cambodia-2012` | labor | tvet | `https://data.opendevelopmentcambodia.net/dataset/be36b82c-b7bd-4a75-a20f-4799b5521b46/resource/b932d537-ea15-4cb1-baab-44c78ea95f56/download/schoolofcambodia.geojson` |
| Electricity Coverage | `electricity-price-and-coverage-areas-in-cambodia` | utilities | substation | fetch via `package_show?id=electricity-price-and-coverage-areas-in-cambodia` |
| Protected Areas | `protected-areas-and-forests-2013` | risk | (polygon) | fetch via `package_show?id=protected-areas-and-forests-2013` |
| Roads | `road-detections-from-microsoft-maps-aerial-imagery` | infrastructure | corridor | fetch via `package_show?id=road-detections-from-microsoft-maps-aerial-imagery` |
| Water Plants | `water-treatment-plant-in-phnom-penh` | utilities | substation | fetch via `package_show?id=water-treatment-plant-in-phnom-penh` |

For datasets without known URLs, use `package_show` to get the GeoJSON resource URL, then fetch it.

---

### STEP 3 — Parse and map each GeoJSON feature to MapSite schema

For each feature in each GeoJSON FeatureCollection, apply the mapping rules below:

#### A. Universities (`public_universities.geojson`)
- `kind` = `"university"`, `layer` = `"labor"`
- `name` = `properties.university` or `properties.name`
- `province` = `properties.province`
- `lat` = `geometry.coordinates[1]`, `lng` = `geometry.coordinates[0]`
  - If coordinates are in UTM (values > 100,000), use Nominatim to geocode: `GET https://nominatim.openstreetmap.org/search?q={name}+Cambodia&format=json&limit=1`
- `notes` = `"Public university in {province}. Established {properties.established}."`
- `status` = `"Operational"`
- `target_industries` = `["Industrial Engineering", "Manufacturing Technology", "Logistics Management"]`
- `id` = `"odc-university-{province-slug}-{name-slug}"` (lowercase, spaces→hyphens, max 60 chars)

#### B. Schools → filter to TVET only (`schoolofcambodia.geojson`)
- Only include features where `properties.type` or `properties.school_type` contains "Technical" or "Vocational" or "TVET" or "polytechnic"
- If no type field exists, skip schools with fewer than 200 students (too small for industrial labor pipeline)
- `kind` = `"tvet"`, `layer` = `"labor"`
- `name` = `properties.name` or `properties.school_name`
- `province` = `properties.province`
- `lat/lng` from geometry (check if UTM → geocode if needed)
- `notes` = `"Technical/vocational training center in {province}."`
- `status` = `"Operational"`
- `target_industries` = `["Garment & Textile", "Electronics Assembly", "Food Processing"]`
- `id` = `"odc-tvet-{province-slug}-{name-slug}"`

#### C. Electricity Coverage (`electricity_price_coverage_geojson.zip` or GeoJSON)
- `kind` = `"substation"`, `layer` = `"utilities"`
- One record per electricity license holder / coverage zone
- `name` = `properties.licensee` or `properties.name` + " Power Coverage"
- `province` = `properties.province` or derive from coordinates
- `lat/lng` = centroid of polygon geometry (use: sum coordinates / count)
- `utilities` = `"EDC coverage area. Rate: {properties.tariff} USD/kWh"` if tariff available
- `status` = `"Operational"`
- `notes` = `"Electricity distribution coverage area — {properties.licensee}"`
- `id` = `"odc-substation-{province-slug}-{licensee-slug}"`

#### D. Protected Areas (`protected-areas-and-forests-2013`)
- `kind` = `"corridor"` (use as closest match for zone/boundary), `layer` = `"risk"`
- One record per protected area polygon
- `name` = `properties.name` or `properties.areaname`
- `province` = `properties.province` or derive from coordinates
- `lat/lng` = polygon centroid
- `notes` = `"Protected area — environmental constraint zone. No industrial development permitted."`
- `constraints` = `["Protected area — development restricted", "EIA mandatory for adjacent sites"]`
- `status` = `"Operational"`
- `id` = `"odc-risk-{name-slug}"`

#### E. Roads — National Routes only
- Only include features where `properties.type` = "motorway" OR "primary" OR "trunk" OR `properties.road_type` similar
- `kind` = `"corridor"`, `layer` = `"infrastructure"`
- Take centroid of each line segment (or sample 1 point per major road)
- `name` = `properties.name` or `properties.road_name`; skip unnamed segments
- `lat/lng` = midpoint of LineString coordinates
- `notes` = `"Major road corridor — key logistics access route."`
- `status` = `"Operational"`
- `id` = `"odc-road-{name-slug}"`
- **Limit**: Maximum 30 road entries (only named national roads, skip unnamed segments)

#### F. Water Treatment Plants
- `kind` = `"substation"`, `layer` = `"utilities"` (reuse as closest infrastructure kind)
- `name` = `properties.name` + " Water Treatment Plant"
- `province` = `properties.province`
- `lat/lng` from geometry
- `utilities` = `"Water treatment facility. Capacity: {properties.capacity} m³/day"` if available
- `status` = `"Operational"`
- `notes` = `"Water treatment plant — industrial water supply source."`
- `id` = `"odc-water-{province-slug}-{name-slug}"`

---

### STEP 4 — Deduplicate against existing `sites` table

Before inserting, run this duplicate check:

```sql
SELECT id, name, province FROM sites
WHERE id LIKE 'odc-%';
```

Build a Set of existing `id` values. For each mapped feature:
- If `id` already exists → **skip** (no update needed for static reference data)
- If `name` is very similar to an existing non-ODC entry (e.g., "Institute of Technology of Cambodia" already exists as `u-itc`) → **skip** to avoid duplicating manual currated data
  - Check: `SELECT id FROM sites WHERE name ILIKE '%{first 4 words of name}%'`
  - If any match → skip this feature
- If neither → **insert**

---

### STEP 5 — Insert new sites to Supabase

For each verified-new site, run:

```sql
INSERT INTO sites (id, name, kind, layer, province, lat, lng, size, status, utilities, road, notes, score, strengths, constraints, target_industries, recommendation)
VALUES (
  '{id}',
  '{name}',
  '{kind}',
  '{layer}',
  '{province}',
  {lat},
  {lng},
  {size_or_null},
  '{status}',
  {utilities_or_null},
  {road_or_null},
  '{notes}',
  {score_or_null},
  {strengths_array_or_null},
  {constraints_array_or_null},
  {target_industries_array_or_null},
  {recommendation_or_null}
)
ON CONFLICT (id) DO NOTHING;
```

Use `ON CONFLICT (id) DO NOTHING` to ensure idempotency — safe to re-run.

---

### STEP 6 — Search for NEW datasets added to ODC this month

Beyond the known priority datasets, search for any new datasets added to ODC in the last 30 days that may contain NEW industrial/SEZ data:

```
GET https://data.opendevelopmentcambodia.net/api/3/action/package_search?q=&fq=odm_spatial_range_list:kh&rows=30&sort=metadata_created+desc
```

For each result where `metadata_created` is within 30 days:
- Check if the dataset contains GeoJSON resources
- Check if any dataset title/tags contain: "SEZ", "special economic zone", "industrial", "factory", "port", "airport", "substation", "power plant", "road", "expressway", "university", "TVET"
- If relevant + has GeoJSON → fetch, parse, and insert using same mapping rules above
- Assign `kind` and `layer` based on the dataset category:
  - SEZ/industrial zone → `layer: "investment"`, `kind: "sez"` or `kind: "park"`
  - Road/transport → `layer: "infrastructure"`, `kind: "corridor"`
  - Power/electricity → `layer: "utilities"`, `kind: "substation"`
  - University/school → `layer: "labor"`, `kind: "university"` or `kind: "tvet"`
  - Protected area/flood → `layer: "risk"`

---

### STEP 7 — Coordinate validation

Before inserting any row, validate coordinates are within Cambodia's bounding box:
- **Lat**: must be between `9.5` and `15.0`
- **Lng**: must be between `102.0` and `108.0`

If coordinates fail validation:
- Try geocoding via Nominatim: `GET https://nominatim.openstreetmap.org/search?q={name}+{province}+Cambodia&format=json&limit=1`
- Use `lat` / `lon` from first result
- If still no valid coordinates → skip this feature entirely

---

### STEP 8 — Report

After completing all operations, output a structured summary:

```
## ODC Map Harvester Run — {YYYY-MM-DD}

### Sources Processed
- Universities: {N} features fetched → {N_new} new, {N_dup} skipped (duplicate)
- TVET Schools: {N} fetched → {N_new} new, {N_dup} skipped
- Electricity Coverage: {N} fetched → {N_new} new, {N_dup} skipped
- Protected Areas: {N} fetched → {N_new} new, {N_dup} skipped
- Roads (named national): {N} fetched → {N_new} new, {N_dup} skipped
- Water Plants: {N} fetched → {N_new} new, {N_dup} skipped
- New ODC datasets this month: {N} found → {N_relevant} relevant → {N_new} added

### Totals
- ✅ New sites inserted: {TOTAL_NEW}
- ⏭ Skipped (existing): {TOTAL_SKIPPED}
- ❌ Rejected (bad coords / no GeoJSON): {TOTAL_REJECTED}

### New Sites Added
{List each new site: name | kind | layer | province | lat,lng}
```

---

## Quality Rules

1. **Never insert a site without valid Cambodia coordinates** (bbox check in Step 7)
2. **Never duplicate manually curated sites** — if a name match exists in non-ODC rows, skip
3. **ODC IDs must start with `odc-`** — this prefix distinguishes auto-harvested from hand-curated sites
4. **Min useful fields**: every inserted row must have at minimum: id, name, kind, layer, province, lat, lng, notes
5. **TVET filter**: from schools dataset, only include technical/vocational institutions — not primary or secondary schools
6. **Road filter**: only named national/primary roads — not unnamed or local roads (would create hundreds of useless points)
7. **Protected area filter**: only include areas > 1,000 ha (smaller zones are too granular)

---

## Coordinate System Note

ODC datasets may use two coordinate systems:
- **WGS84 decimal degrees** (lat ~10–14, lng ~102–108): use directly
- **UTM Zone 48N/49N** (x ~200,000–800,000, y ~1,000,000–1,700,000): must convert

UTM to WGS84 conversion (approximate for Cambodia):
- Zone 48N: `lat = y/111320, lng = 102 + (x - 166022)/95000` (rough; use Nominatim geocoding instead for accuracy)

When in doubt, geocode by name via Nominatim rather than trying to convert UTM manually.
