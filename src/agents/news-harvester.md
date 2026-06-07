# Weekly News Harvester — TheGentryLab

## Schedule
Every Monday 07:00 ICT (00:00 UTC)

## Mission
Find the most useful, decision-relevant Cambodia industrial news from the past 7 days across ALL sectors and write real, working entries to Supabase. Quality over quantity — only include news that would matter to a foreign manufacturer or investor making site-selection or investment decisions.

## Sectors to cover (search ALL of these)
1. **Garment** — new factories, brand relocations, labour policy, export quota news
2. **Electronics** — PCB plants, component factories, EV supply chain, semiconductor assembly
3. **Automotive** — EV assembly, CKD plants, Tier-1 suppliers, ASEAN automotive policy
4. **Food Processing** — agro-processing, beverage plants, cold chain, food safety regulation
5. **Warehousing** — logistics hubs, dry ports, cold storage, last-mile, bonded warehouses
6. **Data Center** — colocation, cloud, carrier-neutral, edge POP, government data policy
7. **Energy** — solar, wind, hydro, grid expansion, EDC substations, PPA tenders
8. **Infrastructure** — expressways, ports, airports, rail, roads, bridges
9. **Policy** — CDC/QIP changes, EIA rules, tax incentives, trade agreements, labour law

## Search strategy (run ALL of these)
```
WebSearch: "Cambodia garment factory 2026"
WebSearch: "Cambodia electronics manufacturing 2026"
WebSearch: "Cambodia EV assembly automotive 2026"
WebSearch: "Cambodia food processing agro industrial 2026"
WebSearch: "Cambodia warehouse logistics cold chain 2026"
WebSearch: "Cambodia data center investment 2026"
WebSearch: "Cambodia energy solar wind EDC 2026"
WebSearch: "Cambodia expressway port airport infrastructure 2026"
WebSearch: "Cambodia CDC QIP investment policy 2026"
WebSearch: site:khmertimeskh.com Cambodia industrial investment 2026
WebSearch: site:phnompenhpost.com Cambodia industry factory 2026
WebSearch: site:asia.nikkei.com Cambodia 2026
```

## Quality filter — ONLY include if ALL of these are true:
✅ Published within the past 14 days (be generous if news is slow week)  
✅ Has a real, working article URL (not a homepage, not a search page)  
✅ About a specific investment, project, policy, or infrastructure development in Cambodia  
✅ Relevant to at least one of the 9 sectors above  
✅ Not a general economic forecast or opinion piece  

## For each qualifying article (up to 12)

Extract:
1. `id` — `n-YYYYMMDD-slug` using article publish date (e.g. `n-20260607-hyundai-kampot-sez`)
2. `headline` — exact article headline, not paraphrased
3. `source` — publication name (e.g. "Khmer Times", "Nikkei Asia", "Phnom Penh Post")
4. `date` — publish date YYYY-MM-DD
5. `sector` — best match from: Garment | Electronics | Food Processing | Warehousing | Data Center | Automotive | Energy | Infrastructure | Policy
6. `province` — most specific Cambodia province, or "Nationwide" if truly national
7. `summary` — exactly 2 sentences: sentence 1 = what happened (facts, numbers), sentence 2 = why it matters for investors
8. `url` — full original article URL — MUST be a direct article link, not a homepage
9. `image_url` — WebFetch the article page, extract `<meta property="og:image" content="...">` value; NULL if not found

## Supabase write process
**Project ID:** `mcxfukjopdnouicwacbn`
**MCP:** `mcp__2d9cdc4d-820f-40d1-b353-d5b5fe2deb29`

For each article:
1. Check duplicate: `SELECT id FROM news WHERE headline ILIKE '%FIRST_5_WORDS%'`
2. Skip if found
3. Insert if new:
```sql
INSERT INTO news (id, headline, source, date, sector, province, summary, url, image_url)
VALUES (...);
```

After all inserts:
```sql
SELECT COUNT(*) FROM news;
-- If > 100: DELETE FROM news WHERE id IN (SELECT id FROM news ORDER BY date ASC LIMIT (count - 100))
```

## Output report
```
=== TheGentryLab News Harvester Run ===
Date: YYYY-MM-DD
Searches run: N
Articles found: N
Quality filter passed: N
Duplicates skipped: N
New articles inserted: N
Sectors covered: [list]
Provinces covered: [list]
Supabase news table total: N rows
```
