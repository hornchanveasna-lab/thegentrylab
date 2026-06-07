# Weekly News Harvester — TheGentryLab

## Schedule
Every Monday 07:00 ICT (00:00 UTC)

## Task
Search for Cambodia industrial, manufacturing, and investment news published in the past 7 days.

## Sources to search
- Khmer Times: https://www.khmertimeskh.com (search: "factory" OR "SEZ" OR "industrial" OR "investment")
- Phnom Penh Post: https://www.phnompenhpost.com/business
- Nikkei Asia: https://asia.nikkei.com (search: "Cambodia")
- Reuters: https://www.reuters.com (search: "Cambodia industry" OR "Cambodia factory")
- CAA Cambodia: https://www.caa.gov.kh
- SEZ Board: https://www.sezb.gov.kh

## For each article found (up to 10 new articles)

Extract:
1. `id` — format: `n-YYYYMMDD-slug` (e.g. `n-20260607-hyundai-ksez`)
2. `headline` — exact article title
3. `source` — publication name (e.g. "Khmer Times")
4. `date` — publish date, format: YYYY-MM-DD
5. `sector` — one of: `Garment`, `Electronics`, `Food Processing`, `Warehousing`, `Data Center`, `Automotive`, `Energy`, `Infrastructure`, `Policy`
6. `province` — most relevant Cambodia province, or "Nationwide"
7. `summary` — 2-sentence summary, plain English, no markdown
8. `url` — original article URL (full URL, not shortened)
9. `image_url` — fetch the article page and extract `<meta property="og:image" content="...">` value; if not found, leave null

## Supabase write process
1. Use Supabase MCP (`mcp__2d9cdc4d-820f-40d1-b353-d5b5fe2deb29__execute_sql`)
2. Project ID: `mcxfukjopdnouicwacbn`
3. Check for duplicates: `SELECT id FROM news WHERE headline = '...'` — skip if exists
4. Insert new rows into `news` table
5. After insert, check total count: `SELECT COUNT(*) FROM news`
6. If count > 100, delete oldest: `DELETE FROM news WHERE id IN (SELECT id FROM news ORDER BY date ASC LIMIT n)` where n = count - 100

## Output
Report how many articles were found, how many were new, and how many were skipped (duplicates).
