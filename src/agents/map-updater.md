# Monthly Map Site Updater — TheGentryLab

## Schedule
1st of each month 08:00 ICT (01:00 UTC)

## Task
Search for new Cambodian SEZ approvals, industrial park openings, factory construction milestones, new substations, or major road/port infrastructure completions from the past 30 days. Update the Supabase `sites` table.

## Sources to search
- SEZ Board Cambodia: https://www.sezb.gov.kh
- CDC Cambodia: https://www.cdc.gov.kh
- EDC Cambodia: https://www.edc.com.kh (new substations, grid expansions)
- MPWT (roads/ports): https://www.mpwt.gov.kh
- Khmer Times, Phnom Penh Post (industrial/infrastructure section)

## MapSite schema (map each find to these fields)

| Field | Type | Notes |
|---|---|---|
| `id` | text | slug, e.g. `sez-koh-kong-2026` |
| `name` | text | Full site name |
| `kind` | text | `sez`, `park`, `factory`, `logistics`, `port`, `airport`, `substation`, `tvet`, `university` |
| `layer` | text | `investment`, `infrastructure`, `utilities`, `risk`, `labor`, `corridors` |
| `province` | text | Cambodia province |
| `lat` | numeric | Approximate latitude |
| `lng` | numeric | Approximate longitude |
| `size` | text | e.g. "120 ha" |
| `status` | text | `Operational`, `Under Construction`, `Planned` |
| `utilities` | text | Power supply info |
| `road` | text | Road access |
| `score` | integer | 0-100 suitability score |
| `strengths` | text[] | Array of strength points |
| `constraints` | text[] | Array of constraints |
| `target_industries` | text[] | Array of target sectors |
| `recommendation` | text | 1-2 sentence advisory recommendation |

## Supabase write process
1. Use Supabase MCP, project ID: `mcxfukjopdnouicwacbn`
2. Check for existing: `SELECT id, status FROM sites WHERE name ILIKE '%...%'`
3. For NEW sites: INSERT into `sites`
4. For EXISTING sites with status change: UPDATE `status`, `updated_at`

## Output
Report: N new sites added, N sites updated, N skipped (no change or already current).
