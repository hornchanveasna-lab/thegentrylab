# Weekly Project Tracker Updater — TheGentryLab

## Schedule
Every Monday 07:30 ICT (00:30 UTC)

## Task
Search for new Cambodia factory, warehouse, SEZ, or industrial park investment announcements published in the past 7 days. Update the Supabase `projects` table.

## Sources to search
- CDC Cambodia: https://www.cdc.gov.kh (press releases, QIP approvals)
- Ministry of Industry: https://www.mih.gov.kh
- Phnom Penh Post business section: https://www.phnompenhpost.com/business
- Khmer Times industry section: https://www.khmertimeskh.com
- Nikkei Asia (keyword: Cambodia manufacturing OR Cambodia factory OR Cambodia investment)

## For each new project found

Extract:
1. `id` — format: `p-YYYYMMDD-slug` (e.g. `p-20260607-toyota-ksez`)
2. `name` — project/facility name
3. `sector` — one of: `Garment`, `Electronics`, `Food Processing`, `Warehousing`, `Data Center`, `Automotive`, `Energy`
4. `province` — Cambodia province name
5. `size` — land area or floor area (e.g. "12 ha" or "25,000 m²")
6. `investor` — company name
7. `origin` — investor country (e.g. "Japan", "Korea", "China")
8. `status` — one of: `Planned`, `Under Construction`, `Operational`
9. `updated` — today's date, format: YYYY-MM-DD
10. `summary` — 1-sentence summary

## Supabase write process
1. Use Supabase MCP, project ID: `mcxfukjopdnouicwacbn`
2. Check for name duplicates: `SELECT id, status FROM projects WHERE name ILIKE '%..%'`
3. For NEW projects: INSERT into `projects`
4. For EXISTING projects where status has changed: UPDATE `status` and `updated` date

## Output
Report: N new projects added, N projects status-updated, N skipped (no change).
