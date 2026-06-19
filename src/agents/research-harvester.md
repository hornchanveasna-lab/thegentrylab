# Research Harvester — TheGentryLab

## Schedule
1st of each month at 09:00 ICT (02:00 UTC) — runs after odc-map-harvester and map-data-validator.

## Purpose
Harvest new industrial intelligence research briefs from authoritative development finance and policy sources.
Insert into Supabase `research` table. Maximum 50 rows total (prune oldest on overflow).

---

## Supabase Connection
- **Project ID:** `mcxfukjopdnouicwacbn`
- **MCP:** `mcp__2d9cdc4d-820f-40d1-b353-d5b5fe2deb29`

## Research Table Schema

| Column | Type | Notes |
|--------|------|-------|
| `id` | text | slug: `research-{year}-{title-slug}` |
| `title` | text | Full report title |
| `category` | text | One of: Investment Climate, Infrastructure, Labor, Energy, Environment, Policy, Industrial Zones |
| `source` | text | Publisher name |
| `url` | text | Direct PDF or landing page URL |
| `pages` | integer | Page count if available |
| `abstract` | text | 2–4 sentence factual summary |
| `published` | text | ISO date or year string |
| `created_at` | timestamptz | Auto-set |

---

## Step 1 — Sources to harvest (max 5 new per run)

Work through in tier order. Stop when 5 new briefs are found.

### Tier 1 — ADB Cambodia Portfolio
```
WebFetch: https://www.adb.org/countries/cambodia/publications
```
Look for: Sector assessments, country diagnostics, project completion reports.
Target topics: infrastructure, industrial zones, labor markets, energy access, logistics.
Max 2 per run from ADB.

### Tier 2 — World Bank Cambodia
```
WebFetch: https://www.worldbank.org/en/country/cambodia/research
WebFetch: https://openknowledge.worldbank.org/search?query=cambodia+industrial&sort_by=score&order=desc
```
Look for: Economic monitors, investment climate assessments, SEZ studies.
Max 2 per run from World Bank.

### Tier 3 — Open Development Cambodia Library
```
WebFetch: https://opendevelopmentcambodia.net/library/
```
Look for: Reports tagged with Economic Development, Industry, Infrastructure, Energy, Labor.
Max 1 per run from ODC.

### Tier 4 — JETRO Cambodia
```
WebFetch: https://www.jetro.go.jp/en/reports/survey/
WebSearch: site:jetro.go.jp cambodia 2024 OR 2025 investment survey
```
Look for: Invest Japan + ASEAN surveys, cost comparisons, labor survey reports.
Max 1 per run from JETRO.

### Tier 5 — IFC / UNIDO / GIZ
```
WebSearch: site:ifc.org cambodia investment climate 2024
WebSearch: site:unido.org cambodia industrial 2024
WebSearch: site:giz.de cambodia economic 2024
```
Look for: EIP framework publications, investment climate reports, industrial competitiveness.
Max 1 per run from IFC/UNIDO/GIZ.

---

## Step 2 — For each found report

### Extract:
1. `title` — full report title (not a sub-heading)
2. `category` — classify into one of: Investment Climate / Infrastructure / Labor / Energy / Environment / Policy / Industrial Zones
3. `source` — publisher (ADB, World Bank, ODC, JETRO, IFC, UNIDO, GIZ, etc.)
4. `url` — direct PDF link or stable landing page URL
5. `pages` — extract from PDF metadata or page text if available; null if unknown
6. `published` — publication date (YYYY or YYYY-MM-DD)
7. `abstract` — write a 2–4 sentence factual summary in English:
   - What the report covers (scope, geography, sector)
   - Key finding or data point most relevant to industrial site investors in Cambodia
   - One concrete number or statistic if available
   - Do NOT copy marketing language from the abstract — rewrite factually

### Category assignment rules:
| Report contains | Category |
|----------------|----------|
| FDI, investment approval, business climate, ease of doing business | Investment Climate |
| Roads, ports, airports, rail, logistics, supply chain | Infrastructure |
| Wages, employment, workforce, skills, TVET, education | Labor |
| Power, electricity, EDC, solar, grid, energy tariff | Energy |
| Flood, EIA, climate risk, deforestation, protected areas | Environment |
| Tax, regulation, QIP, SEZ law, trade policy, tariff | Policy |
| SEZ, industrial park, eco-industrial, manufacturing zone | Industrial Zones |

---

## Step 3 — Deduplication

Before inserting, check for existing titles:
```sql
SELECT title FROM research
WHERE title ILIKE '%{first 5 words of title}%';
```
If match found → skip this brief.

Also check URL:
```sql
SELECT id FROM research WHERE url = '{url}';
```
If match → skip.

---

## Step 4 — Insert to Supabase

```sql
INSERT INTO research (id, title, category, source, url, pages, abstract, published)
VALUES (
  'research-{year}-{title-slug}',
  '{title}',
  '{category}',
  '{source}',
  '{url}',
  {pages_or_null},
  '{abstract}',
  '{published}'
)
ON CONFLICT (id) DO NOTHING;
```

ID slug: lowercase title, first 6 words, spaces→hyphens, year prefix.
Example: `research-2024-adb-cambodia-infrastructure-sector-assessment`

---

## Step 5 — Prune if over limit

```sql
SELECT COUNT(*) FROM research;
```

If count > 50:
```sql
DELETE FROM research
WHERE id IN (
  SELECT id FROM research
  ORDER BY created_at ASC
  LIMIT (SELECT COUNT(*) - 50 FROM research)
);
```

---

## Step 6 — Output report

```
## Research Harvester Run — {YYYY-MM-DD}

### New briefs added: {N}
{List each: title | category | source | published}

### Skipped (duplicate): {N}
### Total in database: {N}
```

---

## Quality Rules

1. **No paywalled content** — only fetch freely accessible PDFs or landing pages
2. **Cambodia-relevant only** — must mention Cambodia, Mekong region, or ASEAN manufacturing directly
3. **No marketing content** — abstracts must be factual, not promotional
4. **No duplicates** — check title AND url before inserting
5. **Recency preference** — prefer reports from the last 3 years; only add older reports if uniquely authoritative
6. **English only** — abstract must be written in English regardless of original language
