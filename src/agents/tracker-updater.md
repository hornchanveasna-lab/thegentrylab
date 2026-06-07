# Weekly Project Tracker Updater — TheGentryLab

## Schedule
Every Monday 07:30 ICT (00:30 UTC)

## Mission
1. **Discover** all Cambodia industrial projects approved by CDC (QIP status) or announced by credible sources
2. **Enrich** each project with full status detail — construction progress, delays, changes, disputes, operational milestones
3. **Find the latest news** about each project (good OR bad — delays, disputes, expansions, all matter)
4. **Fetch the OG image** from the latest news article as the project's cover photo
5. **Geocode** each project location via Nominatim
6. Write everything to Supabase `projects` table (project ID: `mcxfukjopdnouicwacbn`)

---

## PART A — Discover New Projects

### Primary: CDC QIP Approvals (run these first)
```
Search queries:
1. site:invest.gov.kh "QIP" OR "qualified investment project" approved 2024 2025 2026
2. site:cdc.gov.kh investment approval factory manufacturing
3. "CDC Cambodia" "QIP approval" factory 2025 2026
4. site:opendevelopmentcambodia.net "qualified investment" factory approved
5. Cambodia CDC investment certificate garment electronics automotive food energy 2025 2026
```

For each CDC QIP found, extract:
- Official project name from the approval notice
- Investor company + origin country
- Sector (Garment / Electronics / Food Processing / Warehousing / Data Center / Automotive / Energy)
- Province / SEZ location
- Investment size (USD value or land area) → store as `investment_usd` (e.g. "$32M", "$250M")
- Approval date → store as `updated` (ISO) AND `cdc_approval_date` (e.g. "May 2025")
- Planned completion / commissioning date → `planned_finish` (e.g. "Q3 2026", "2027")
- CDC press release URL → `source_url`

### Secondary: All Other Credible Sources (4-tier search)

**Tier 1 — Official & multilateral:**
- `site:sezb.gov.kh` new tenant / zone announcement
- `site:adb.org/projects` Cambodia manufacturing / industry active
- `site:projects.worldbank.org` Cambodia industry factory
- `site:mih.gov.kh` operating licence / investment announcement

**Tier 2 — Quality regional media:**
- `site:khmertimeskh.com` factory investment construction groundbreaking
- `site:phnompenhpost.com/business` factory warehouse SEZ Cambodia
- `site:cambojanews.com` industrial investment
- `site:asia.nikkei.com` Cambodia manufacturing factory
- `site:reuters.com` Cambodia factory investment
- `site:aseanbriefing.com` Cambodia manufacturing 2025 2026

**Tier 3 — Origin-country trade bodies:**
- `site:jetro.go.jp` Cambodia factory (Japanese FDI)
- `site:koreaherald.com` Cambodia factory investment (Korean FDI)
- China MOFCOM Cambodia factory 2025 2026 (Chinese FDI)
- `site:gtai.de` Cambodia industrial (German FDI)
- `site:boi.go.th` Cambodia relocation factory supply chain

**Tier 4 — Logistics & trade signals:**
- `site:ppsez.com.kh` new tenant occupancy
- Sihanoukville port machinery import Cambodia factory
- `site:china-briefing.com` Cambodia manufacturing supply chain

---

## PART B — Status Deep Research (for EVERY project, new and existing)

For each project (new AND already in Supabase), run targeted searches to find its current status:

```
Search: "{project name}" Cambodia construction OR operational OR delay OR expansion OR dispute 2025 2026
Search: "{investor name}" Cambodia factory update progress
Search: "{project name}" site:khmertimeskh.com OR site:phnompenhpost.com OR site:asia.nikkei.com
```

Determine actual status:
- If articles report groundbreaking / foundation laid / steel frame → `Under Construction`
- If articles report first production / customs clearance / exports started → `Operational`
- If articles report delay / suspended / permit issue → keep `Planned` or `Under Construction` but note in summary
- If articles report cancelled / withdrawn → add "(Cancelled)" to name and update summary

Update `status` in Supabase if changed. Always update `updated` to today.

---

## PART C — Latest News Fetch (for EVERY project)

For each project, find the **single most recent news article** about it:

```
Search: "{project name}" OR "{investor}" Cambodia news 2025 2026
→ Pick the most recent result (by date, not relevance)
→ This can be ANY news — positive (expansion, new hires, export milestone)
   OR negative (delay, labour dispute, permit blocked, environmental complaint)
   Both are valuable intelligence for investors.
```

From the most recent article:
1. **WebFetch the article URL**
2. Extract `<meta property="og:image">` → store as `image_url` (this becomes the project cover photo)
3. Extract article headline → `latest_news_headline`
4. Extract publish date → `latest_news_date` (YYYY-MM-DD)
5. Store article URL → `latest_news_url`

If no news found in past 6 months: leave `latest_news_*` fields NULL (don't overwrite with old data).

---

## PART D — Geocoding

For each project:
```
1. Try: GET https://nominatim.openstreetmap.org/search?q={investor}+{province}+Cambodia&format=json&limit=1
2. If no result: GET https://nominatim.openstreetmap.org/search?q={project_name}+Cambodia&format=json&limit=1
3. If still no result: use province centroid (table below)
4. Build: maps_url = https://www.google.com/maps/search/?api=1&query={lat},{lng}

Province centroids:
  Phnom Penh: 11.5564, 104.9282 | Kandal: 11.2833, 104.9500
  Kampong Speu: 11.4500, 104.5200 | Sihanoukville/Preah Sihanouk: 10.6167, 103.5167
  Svay Rieng: 11.0833, 105.8000 | Kampong Cham: 11.9931, 105.4636
  Siem Reap: 13.3671, 103.8448 | Kampong Thom: 12.4833, 104.9667
  Pursat: 12.5388, 103.9192 | Kampot: 10.6045, 104.1810
  Battambang: 13.0957, 103.2022 | Takeo: 10.9908, 104.7988
```

---

## PART E — Supabase Write

Use Supabase MCP, project ID: `mcxfukjopdnouicwacbn`

### Quality filter before writing:
- ✅ Cambodia-based physical facility (not just financial investment)
- ✅ Industrial / manufacturing / logistics / energy / data center
- ✅ Named investor with verifiable origin country
- ✅ CDC QIP approved OR confirmed by 2+ credible sources
- ❌ Skip: MOU only, letter of intent only, retail, hospitality, residential

### For each project:

**Check duplicate:**
```sql
SELECT id, status, latest_news_date FROM projects WHERE name ILIKE '%{name}%';
```

**INSERT new (all 21 fields):**
```sql
INSERT INTO projects (
  id, name, sector, province, size, investor, origin,
  status, updated, summary,
  lat, lng, maps_url, source_url, image_url,
  latest_news_headline, latest_news_url, latest_news_date,
  cdc_approval_date, investment_usd, planned_finish
) VALUES (
  '{id}', '{name}', '{sector}', '{province}', '{size}',
  '{investor}', '{origin}', '{status}', '{today}', '{summary}',
  {lat}, {lng}, '{maps_url}', '{source_url}', '{image_url}',
  '{latest_news_headline}', '{latest_news_url}', '{latest_news_date}',
  '{Mon YYYY}', '{$XM}', '{Q? YYYY or YYYY}'
);
```

**UPDATE existing (status + news refresh):**
```sql
UPDATE projects SET
  status               = '{status}',
  updated              = '{today}',
  summary              = '{updated_summary}',
  image_url            = '{og_image_from_latest_news}',
  latest_news_headline = '{headline}',
  latest_news_url      = '{article_url}',
  latest_news_date     = '{article_date}'
WHERE id = '{id}';
```

---

## PART F — Output Report

```
## Tracker Update — {today}

### CDC QIP Projects Found: N
- {name} ({sector}, {province}) — CDC approved {date}

### New projects added: N
- {name} ({sector}) — {investor} [{origin}] — source: {domain}

### Status updates: N
- {name}: {old} → {new} (based on: {article})

### News refreshed: N projects
- Latest coverage dates range: {oldest} to {newest}

### Skipped: N (no confirmed physical facility)

### Final table:
  Planned: N | Under Construction: N | Operational: N | Total: N
```
