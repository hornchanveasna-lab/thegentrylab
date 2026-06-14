# Map Data Validator & Enrichment Agent — TheGentryLab

## Purpose
Run monthly. Validate every site coordinate in `src/data/platform.ts`, enrich sparse data,
and source real news/official **photos** for each site so the Inspector panel shows
meaningful images instead of map tiles.

---

## Step 1 — Load site list

Read `src/data/platform.ts`. Extract `export const SITES: MapSite[]`.
Record: `{ id, name, kind, province, lat, lng, image_url }` for each site.

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
Wait **1.1 seconds between requests**.

### 2b. Google Maps Geocoding (if VITE_GOOGLE_MAPS_KEY set)
```
GET https://maps.googleapis.com/maps/api/geocode/json
  ?address={site.name}+{site.province}+Cambodia
  &key={VITE_GOOGLE_MAPS_KEY}
```

### Flag rules
| Distance | Action |
|---|---|
| < 1 km | ✅ PASS |
| 1–5 km | ⚠️ REVIEW — log |
| > 5 km | ❌ AUTO-FIX with verified source |

For ❌ sites: write corrected lat/lng + add comment `// Coord verified {DATE} via {SOURCE}`

---

## Step 3 — News image sourcing (PRIORITY — run for ALL sites missing `image_url`)

For each site where `image_url` is undefined or empty:

### 3a. Search for news coverage

Work through sources in **tier order** — stop as soon as a valid image is found for each site.

**Tier 1 — Cambodia-specialist (highest hit rate):**
```
thebettercambodia.com: "{site.name}"
cambodiainvestmentreview.com: "{site.name}"
phnompenhpost.com: "{site.name}" Cambodia
```

**Tier 2 — Regional English-language media:**
```
asia.nikkei.com: "{site.name}" Cambodia
aseanbriefing.com: "{site.name}" Cambodia
bangkokpost.com: "{site.name}" Cambodia
reuters.com: "{site.name}" Cambodia
```

**Tier 3 — Trade & investment sources:**
```
investasean.com: "{site.name}" Cambodia
jetro.go.jp: "{site.name}" Cambodia
china-briefing.com: "{site.name}" Cambodia
vietnam-briefing.com: "{site.name}" Cambodia
```

**Tier 4 — General web search fallback:**
```
WebSearch: site:thebettercambodia.com OR site:phnompenhpost.com OR site:reuters.com "{site.name}" Cambodia
WebSearch: "{site.name}" Cambodia factory OR SEZ OR port OR airport photo
```

> **Skip known-blocked sources:** `khmertimeskh.com` and `cambodianess.com` both return HTTP 403
> on automated fetches — do not attempt these.

For each article found:
1. WebFetch the article URL
2. Extract `<meta property="og:image" content="...">` — this is the article hero photo
3. Verify the URL ends in .jpg/.jpeg/.png/.webp OR is a CDN URL (wp-content, cloudfront, imgix, etc.)
4. Confirm URL is publicly accessible (no auth redirect, no login wall)

### 3b. Official site images
If no news image found after all tiers, try the official developer/operator website:
- PPSEZ: `https://www.ppsez.com.kh/en/`
- SSEZ: `http://www.ssez.com/en/`
- WHA: `https://www.wha-industrialestate.com/en/cambodia`
- Techo Airport: `https://techo-airport.gov.kh/`
- SAP Port: `https://www.sihanoukvilleport.com.kh/`
- Siem Reap Airport: `https://siemreapairport.com/`
- ITC: `https://itc.edu.kh/`
- RUPP: `https://www.rupp.edu.kh/`
- NPIC: `https://www.npic.edu.kh/`
- **All substations** — EDC (Électricité du Cambodge) official website: `https://www.edc.com.kh/`
  - Primary source for substation locations, voltage levels, capacity specs, and official photos
  - Check EDC Photo Gallery and News sections for substation imagery
  - WebSearch: `site:edc.com.kh "{substation name}" OR "{province} substation"`
  - Also try: `site:edc.com.kh "230kV" OR "115kV" OR "substation"` for technical details
- For factories: search `{company name} investor relations Cambodia` — look for press release with photo

Extract `<meta property="og:image">` from the fetched page.

### 3c. Image quality rules
- Must be a direct image URL (not a redirect, not a search result)
- Prefer aerial/overview/exterior shots over interior
- Minimum implied size: 400px wide (check if URL has size params)
- No watermarked stock photos

### 3d. Write image_url
Once found, write to `src/data/platform.ts`:
```typescript
image_url: "https://example.com/path/to/image.jpg",
```
Add the field directly after the `id:` line of the matching site object.

---

## Step 4 — Data enrichment

For sites with `notes` under 100 characters:
1. Search: `{site.name} Cambodia investment {current_year}`
2. Extract from top 3 results:
   - Operational status, total area, developer/operator
   - Key tenants, utility details, road access
   - Recent news (expansion, new tenants)
3. Write enriched `notes` (2–4 sentences, factual, no marketing language)
4. Update `status`, `size`, `utilities`, `road` if better data found

---

## Step 5 — Corridor endpoint validation

For each corridor in `CORRIDORS`:
1. Geocode start city — confirm first waypoint within 3km
2. Geocode end city/border — confirm last waypoint within 3km
3. If wrong, re-fetch from OSRM and apply RDP (ε=0.001°):
```
GET https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
  ?overview=full&geometries=geojson
```

---

## Step 6 — Output report

Write `src/agents/last-validation-report.md`:
```markdown
# Validation Report — {DATE}

## Summary
- Sites checked: {N}
- Coordinates corrected: {N}
- Images added: {N}
- Notes enriched: {N}

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
3. **EDC (Électricité du Cambodge)** — `https://www.edc.com.kh/` — **primary source for all substation sites**
   - Official substation locations, voltage (115kV / 230kV), capacity (MVA), operational status
   - Search: `site:edc.com.kh "{substation name}"` for press releases, project announcements
   - EDC news and photo gallery contain aerial/exterior substation photos with location context
4. Open Development Cambodia — `opendevelopmentcambodia.net/profiles/special-economic-zones/`
5. CDC Cambodia — `cdc.gov.kh/sez-smart-search/`
6. SEZB — `sezb.gov.kh`
7. Khmer Times / PP Post — for article coordinates
8. Wikidata — structured data with coordinates

## Province centroid fallback (when no specific data found)
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

## Known tricky sites (extra care required)
- **ISI SEZ**: Trapeang Kou village, Cheung Kou commune, Prey Nob district, Preah Sihanouk. Along PP-SVK Expressway ~30 min north of SAP port. Nominatim Prey Nob district centroid: 10.7197, 103.7985
- **Siem Reap Airport**: NEW airport at 13.368, 104.216 (opened Nov 2023) — NOT old airport at 13.40, 103.81
- **Techo Airport**: New airport at 11.356, 104.932 in Kandal — NOT old PNH at 11.546, 104.848
- **Bavet SEZ cluster**: All around 106.10–106.12E — NOT 105.94E
