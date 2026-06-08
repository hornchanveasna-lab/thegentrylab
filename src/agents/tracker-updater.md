# Weekly Project Tracker Updater — TheGentryLab

## Schedule
Every Monday 07:30 ICT (00:30 UTC)

## Mission
1. **Discover** new Cambodia industrial projects approved by CDC (QIP status) or confirmed by credible sources
2. **Enrich** each project — construction progress, delays, disputes, operational milestones
3. **Find latest news** for every project (good OR bad — both matter to investors)
4. **Fetch OG image** from latest news article as project cover photo
5. **Geocode** project location via Nominatim
6. Write everything to Supabase `projects` table (project ID: `mcxfukjopdnouicwacbn`)

---

## PART A — Discover New Projects

### Step A1: Check what's already in Supabase
```sql
SELECT id, name, sector, province, status, cdc_approval_date FROM projects ORDER BY cdc_approval_date DESC NULLS LAST;
```
Do NOT re-add any project whose name already appears. Check by name substring match.

---

### Step A2: Primary — CDC QIP Approvals (search these first, highest priority)
```
Search 1: site:invest.gov.kh "QIP" OR "qualified investment project" approved 2025 2026
Search 2: site:cdc.gov.kh investment approval factory manufacturing 2025 2026
Search 3: "CDC Cambodia" "QIP approval" factory 2025 2026
Search 4: site:cambodiainvestment.gov.kh investment certificate garment electronics automotive food
Search 5: Cambodia CDC QIP certificate garment electronics automotive energy 2025 2026
Search 6: site:khmertimeskh.com "CDC" "approved" factory investment 2025 2026
Search 7: site:phnompenhpost.com CDC investment QIP factory 2025 2026
Search 8: site:freshnews.com.kh CDC investment factory approval 2026
```

For each CDC QIP found, extract:
- Official project name (from approval notice)
- Investor company name + origin country
- Sector: Garment / Electronics / Food Processing / Warehousing / Data Center / Automotive / Energy
- Province / SEZ location
- Investment size (USD) → `investment_usd` (e.g. "$32M", "$250M")
- Approval date → `updated` (ISO YYYY-MM-DD) AND `cdc_approval_date` (e.g. "May 2025")
- Planned completion date → `planned_finish` (e.g. "Q3 2026", "2027")
- CDC press release URL → `source_url`

---

### Step A3: Secondary — Broader Source Search (4 tiers)

**Tier 1 — Cambodian English media:**
```
site:khmertimeskh.com factory investment construction groundbreaking SEZ 2025 2026
site:phnompenhpost.com/business factory warehouse SEZ Cambodia 2025 2026
site:cambojanews.com industrial investment factory 2025 2026
site:businesscambodia.com factory investment manufacturing 2025 2026
```

**Tier 2 — Cambodian Khmer media (WebFetch + translate):**
```
WebFetch: https://freshnews.com.kh/business
  → Scan headlines for: factory (រោងចក្រ), investment (វិនិយោគ), CDC, SEZ, industrial zone (ដែនដីឧស្សាហកម្ម)
  → WebFetch each matching article to extract project details

WebFetch: https://dap-news.com/category/business/
  → Look for factory, manufacturing, investment articles

WebFetch: https://cnewsasia.com/category/economy/
  → Government-adjacent, often has CDC and ministry announcements

site:thmeykhmer.com factory industrial investment 2025 2026
site:postkhmer.com investment factory industrial 2025 2026
```

**Tier 3 — Regional English media:**
```
site:asia.nikkei.com Cambodia manufacturing factory 2025 2026
site:channelnewsasia.com Cambodia factory investment 2025 2026
site:bangkokpost.com Cambodia factory relocation investment 2025 2026
site:straitstimes.com Cambodia investment industrial 2025 2026
site:reuters.com Cambodia factory investment manufacturing 2025 2026
site:aseanbriefing.com Cambodia manufacturing 2025 2026
site:thediplomat.com Cambodia investment factory 2025 2026
site:vir.com.vn Cambodia factory supply chain 2025 2026
```

**Tier 4 — Origin-country FDI trackers:**
```
Japan:    site:jetro.go.jp Cambodia factory investment
Japan:    site:japantimes.co.jp Cambodia manufacturing 2025 2026
Korea:    site:koreaherald.com Cambodia factory investment 2025 2026
Korea:    site:koreatimes.co.kr Cambodia manufacturing KOCHAM 2025 2026
China:    site:globaltimes.cn Cambodia factory investment 2025 2026
China:    site:xinhuanet.com Cambodia investment factory 2025 2026
China:    site:china-briefing.com Cambodia manufacturing factory 2025 2026
Germany:  site:gtai.de Cambodia industrial investment
Thailand: site:bangkokpost.com Cambodia factory relocation Thailand
Thailand: site:boi.go.th Cambodia supply chain manufacturing
```

**Tier 5 — Official infrastructure / multilateral:**
```
site:sezb.gov.kh new tenant zone announcement
site:mih.gov.kh operating licence investment announcement
site:adb.org/projects Cambodia manufacturing industry active
site:projects.worldbank.org Cambodia industry factory
site:opendevelopmentcambodia.net qualified investment factory approved
```

---

### Step A4: Quality filter before adding any project
- ✅ Cambodia-based physical facility (factory, warehouse, plant, data center — NOT just financial investment)
- ✅ Industrial / manufacturing / logistics / energy / data center sector
- ✅ Named investor with verifiable origin country
- ✅ CDC QIP approved OR confirmed by 2+ credible sources
- ✅ Investment > $1M USD (exclude micro-enterprises)
- ❌ Skip: MOU only, letter of intent only, retail, hospitality, residential real estate, agriculture without processing

---

## PART B — Status Deep Research (for EVERY existing project)

For each project already in Supabase:
```
Search: "{project name}" Cambodia 2025 2026 construction OR operational OR delay OR expansion OR dispute
Search: "{investor name}" Cambodia factory progress update 2025 2026
Search: "{project name}" site:khmertimeskh.com OR site:phnompenhpost.com OR site:freshnews.com.kh
Search: "{project name}" site:asia.nikkei.com OR site:channelnewsasia.com OR site:globaltimes.cn
```

Status rules:
- Reports of groundbreaking / piling / steel frame / concrete → `Under Construction`
- Reports of first production / trial run / export declaration / customs clearance → `Operational`
- Reports of delay / suspended / permit rejected → keep current status, note in summary
- Reports of cancelled / withdrawn / company bankrupt → name += " (Cancelled)", update summary
- No news in 12+ months → keep current status, do not change

Only update `status` if evidence is strong (2+ sources or official announcement).
Always update `updated` = today for any project you research.

---

## PART C — Latest News Fetch (for EVERY project)

For each project, find the single most recent article:
```
Search: "{project name}" OR "{investor}" Cambodia site:khmertimeskh.com OR site:phnompenhpost.com OR site:freshnews.com.kh OR site:asia.nikkei.com 2025 2026
Search: "{project name}" Cambodia news latest
```
Pick the most recent result by publish date (not relevance).
This can be positive (expansion, milestone, hiring) OR negative (delay, dispute, inspection failure). Both are valuable.

From the winning article:
1. **WebFetch** the article URL
2. Extract `<meta property="og:image" content="...">` → `image_url`
3. Extract article headline → `latest_news_headline`
4. Extract publish date → `latest_news_date` (YYYY-MM-DD)
5. Store article URL → `latest_news_url`

Skip update if: no news found in past 6 months, or found article is same as existing `latest_news_url`.

---

## PART D — Geocoding

For each new project (skip if lat/lng already populated):
```
Step 1: GET https://nominatim.openstreetmap.org/search?q={investor_name}+{province}+Cambodia&format=json&limit=1
Step 2: If no result → GET https://nominatim.openstreetmap.org/search?q={project_name}+Cambodia&format=json&limit=1
Step 3: If still no result → use province centroid below
Step 4: maps_url = https://www.google.com/maps/search/?api=1&query={lat},{lng}
```

Province centroids:
```
Phnom Penh:        11.5564, 104.9282
Kandal:            11.2833, 104.9500
Kampong Speu:      11.4500, 104.5200
Preah Sihanouk:    10.6167, 103.5167
Svay Rieng:        11.0833, 105.8000
Kampong Cham:      11.9931, 105.4636
Siem Reap:         13.3671, 103.8448
Kampong Thom:      12.4833, 104.9667
Pursat:            12.5388, 103.9192
Kampot:            10.6045, 104.1810
Battambang:        13.0957, 103.2022
Takeo:             10.9908, 104.7988
Koh Kong:          11.6167, 103.0000
Prey Veng:         11.4850, 105.3250
Kep:               10.4833, 104.3000
```

---

## PART E — Supabase Write

**Project ID:** `mcxfukjopdnouicwacbn`
**MCP:** `mcp__2d9cdc4d-820f-40d1-b353-d5b5fe2deb29`

### Check duplicate before any insert:
```sql
SELECT id, name, status, latest_news_date
FROM projects
WHERE name ILIKE '%{first_3_significant_words}%';
```

### INSERT new project (all 21 fields):
```sql
INSERT INTO projects (
  id, name, sector, province, size, investor, origin,
  status, updated, summary,
  lat, lng, maps_url, source_url, image_url,
  latest_news_headline, latest_news_url, latest_news_date,
  cdc_approval_date, investment_usd, planned_finish
) VALUES (
  '{p-YYYYMMDD-slug}',
  '{name}',
  '{sector}',
  '{province}',
  '{size_description}',
  '{investor_company}',
  '{origin_country}',
  '{Planned|Under Construction|Operational}',
  '{YYYY-MM-DD}',
  '{1-2 sentence summary}',
  {lat}, {lng},
  '{maps_url}',
  '{source_url}',
  '{og_image_url_or_null}',
  '{latest_news_headline_or_null}',
  '{latest_news_url_or_null}',
  '{YYYY-MM-DD_or_null}',
  '{Mon YYYY}',
  '{$XM}',
  '{Q? YYYY or YYYY}'
)
ON CONFLICT (id) DO NOTHING;
```

Valid `origin` values: China, Japan, Korea, USA, Germany, Thailand, Malaysia, Singapore, Denmark, France, Vietnam, Taiwan, Cambodia, Cambodia/Singapore — keep these consistent for the country-code badge system in the frontend.

### UPDATE existing project (news refresh + status):
```sql
UPDATE projects SET
  status               = '{status}',
  updated              = '{YYYY-MM-DD}',
  summary              = '{updated_summary}',
  image_url            = '{og_image_url}',
  latest_news_headline = '{headline}',
  latest_news_url      = '{article_url}',
  latest_news_date     = '{YYYY-MM-DD}'
WHERE id = '{id}';
```

---

## PART F — Output Report

```
## Tracker Update — {today}

### Sources searched: N sites

### CDC QIP Projects Found: N
- {name} ({sector}, {province}) — approved {Mon YYYY} — ${investment}

### New projects added: N
- {name} ({sector}) — {investor} [{origin}] — source: {domain}

### Status updates: N
- {name}: {old_status} → {new_status} (source: {article})

### News refreshed: N projects
- Date range of latest coverage: {oldest} to {newest}

### Skipped / rejected: N
- {reason}: {description}

### Final Supabase table:
  Planned: N | Under Construction: N | Operational: N | Total: N
```
