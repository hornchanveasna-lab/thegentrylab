# Weekly Project Tracker Updater — TheGentryLab

## Schedule
Every Monday 07:30 ICT (00:30 UTC) — runs after news-harvester completes

## Mission
Search for new Cambodia industrial project announcements and status changes across 4 tiers of sources.
For each project: extract full metadata, look up GPS coordinates via Nominatim, extract OG image from source article.
Update the Supabase `projects` table (project ID: `mcxfukjopdnouicwacbn`).

---

## Search Strategy

Run ALL of the following searches (use WebSearch MCP + AI deep research per query):

### Tier 1 — Official & multilateral (run first, highest reliability)
1. `site:invest.gov.kh OR site:cdc.gov.kh factory investment QIP approval 2025 2026`
2. `site:sezb.gov.kh new tenant industrial zone SEZ Cambodia`
3. `site:opendevelopmentcambodia.net factory industrial park investment`
4. `site:adb.org/projects Cambodia manufacturing industry active`
5. `site:projects.worldbank.org Cambodia industry factory infrastructure`
6. `site:mih.gov.kh investment factory operating licence`
7. `Cambodia customs machinery equipment import surge factory 2025 2026`

### Tier 2 — Quality regional media
8. `site:khmertimeskh.com factory investment construction groundbreaking`
9. `site:phnompenhpost.com/business factory warehouse SEZ Cambodia`
10. `site:cambojanews.com industrial investment factory`
11. `site:asia.nikkei.com Cambodia manufacturing factory assembly plant`
12. `site:reuters.com Cambodia factory investment industrial`
13. `site:bangkokpost.com Cambodia industrial manufacturing`
14. `site:aseanbriefing.com Cambodia manufacturing factory 2025 2026`

### Tier 3 — Origin-country trade bodies (catches FDI before Khmer media)
15. `site:jetro.go.jp Cambodia investment factory manufacturing` (Japanese FDI)
16. `site:koreaherald.com OR site:kotra.or.kr Cambodia factory investment` (Korean FDI)
17. `Cambodia factory investment China MOFCOM 2025 2026` (Chinese FDI)
18. `site:gtai.de Cambodia industrial investment` (German FDI)
19. `site:boi.go.th Cambodia relocation factory supply chain` (Thai/supply chain shift)

### Tier 4 — Logistics & trade signals
20. `site:ppsez.com.kh new tenant factory occupancy`
21. `Sihanoukville port cargo machinery equipment import Cambodia factory 2025 2026`
22. `site:china-briefing.com OR site:vietnam-briefing.com Cambodia manufacturing supply chain`
23. `"Cambodia factory" OR "Cambodia industrial park" groundbreaking 2025 2026`

---

## For Each Project Found

### Step 1 — Extract metadata
| Field | Instructions |
|-------|-------------|
| `id` | Format: `p-YYYYMMDD-slug` e.g. `p-20260607-toyota-ksez`. Use today's date + short name slug |
| `name` | Full official facility/project name |
| `sector` | One of: `Garment`, `Electronics`, `Food Processing`, `Warehousing`, `Data Center`, `Automotive`, `Energy`. Use `Infrastructure` or `Policy` only if no other sector fits |
| `province` | Cambodia province (e.g. `Phnom Penh`, `Kandal`, `Kampong Speu`, `Sihanoukville`) |
| `size` | Land area or floor area as stated (e.g. `12 ha`, `25,000 m²`, `50 MW`) |
| `investor` | Company name (official English name) |
| `origin` | Investor country (e.g. `China`, `Japan`, `Korea`, `USA`, `Germany`, `Thailand`) |
| `status` | `Planned`, `Under Construction`, or `Operational` |
| `updated` | Today's date in `YYYY-MM-DD` format |
| `summary` | 1–2 sentence summary. Focus on: what is being built, scale, purpose, timeline |
| `source_url` | Direct URL to the announcement article or press release |

### Step 2 — Extract OG image from source article
```
WebFetch the source_url page.
Look for: <meta property="og:image" content="...">
If found: use that URL as image_url.
If not found: leave image_url as NULL.
```

### Step 3 — Geocode project location
```
Province centroid fallback table (use if Nominatim fails):
  Phnom Penh:    lat=11.5564, lng=104.9282
  Kandal:        lat=11.2833, lng=104.9500
  Kampong Speu:  lat=11.4500, lng=104.5200
  Sihanoukville / Preah Sihanouk: lat=10.6167, lng=103.5167
  Svay Rieng:    lat=11.0833, lng=105.8000
  Kampong Cham:  lat=11.9931, lng=105.4636
  Siem Reap:     lat=13.3671, lng=103.8448
  Kampong Thom:  lat=12.4833, lng=104.9667
  Pursat:        lat=12.5388, lng=103.9192
  Kampot:        lat=10.6045, lng=104.1810
  Battambang:    lat=13.0957, lng=103.2022
  Takeo:         lat=10.9908, lng=104.7988

Try Nominatim first:
  GET https://nominatim.openstreetmap.org/search?q={investor}+{province}+Cambodia&format=json&limit=1
  If result returned: use lat/lon from first result.
  If no result: try https://nominatim.openstreetmap.org/search?q={name}+Cambodia&format=json&limit=1
  If still no result: use province centroid from table above.

Build maps_url:
  https://www.google.com/maps/search/?api=1&query={lat},{lng}
```

---

## Quality Filter

Only include projects that pass ALL of these:
- ✅ Located in Cambodia (not just Cambodia-linked investment from overseas)
- ✅ Industrial / manufacturing / logistics / energy / data center (NOT retail, hospitality, or residential)
- ✅ Named investor with identifiable origin country
- ✅ Physical facility being built or operational (NOT just MOU or letter of intent)
- ✅ Project size mentioned (area, capacity, or investment value)
- ✅ Published within the past 30 days OR status has changed since last recorded

---

## Supabase Write Process

Use Supabase MCP, project ID: `mcxfukjopdnouicwacbn`

### For each project:

**1. Check for duplicate:**
```sql
SELECT id, status FROM projects WHERE name ILIKE '%{name}%';
```

**2a. If NOT found — INSERT new row (all 15 fields):**
```sql
INSERT INTO projects (id, name, sector, province, size, investor, origin, status, updated, summary, lat, lng, maps_url, source_url, image_url)
VALUES (
  '{id}', '{name}', '{sector}', '{province}', '{size}',
  '{investor}', '{origin}', '{status}', '{updated}', '{summary}',
  {lat}, {lng}, '{maps_url}', '{source_url}', '{image_url}'
);
```

**2b. If FOUND and status has changed — UPDATE:**
```sql
UPDATE projects
SET status = '{new_status}', updated = '{today}', source_url = '{source_url}'
WHERE id = '{existing_id}';
```

**2c. If FOUND and no change — SKIP.**

### After all inserts, run final count:
```sql
SELECT status, COUNT(*) as count FROM projects GROUP BY status ORDER BY status;
```

---

## Output Report

```
## Tracker Update — {today}

### New projects added: N
- {name} ({sector}, {province}) — {investor} [{origin}]
- ...

### Status updates: N
- {name}: {old_status} → {new_status}

### Skipped (no change): N

### Sources checked: [list tier 1–4 sources actually fetched]

### Projects table summary:
- Planned: N
- Under Construction: N
- Operational: N
- Total: N
```
