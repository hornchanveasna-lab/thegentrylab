# The Gentry Lab — Data Quality Audit
**2026-07-27** (weekly, automated)

> Note: The Gmail draft could not be created automatically — the connector needs to be reconnected with additional permissions (error: "This connector requires additional permissions. The user needs to reconnect it with the appropriate access."). This report is saved here as a fallback. Once reconnected, re-run the audit or manually paste this into an email.

## Table Health

| Table | Rows | Last 30 days | Most Recent | Oldest |
|-------|------|--------------|-------------|--------|
| news | 46 | 17 | 2026-07-24 | 2024-10-22 |
| projects | 27 | 1 | 2026-07-27 | 2025-11-30 |
| chat_logs | 41 | 31 | 2026-07-11 | 2026-06-19 |
| report_logs | 20 | 15 | 2026-07-11 | 2026-06-19 |

## Auto-Fixed
- No duplicate news articles found (grouped by headline) — nothing to remove
- No duplicate projects found (grouped by name + province) — nothing to remove

## Issues Requiring Manual Attention
- 0 news items missing URL
- 0 news items missing summary
- 0 news items missing sector
- 0 projects missing investor name
- 0 projects missing province
- 0 projects missing summary
- **5 stale projects** (>90 days since last update, still `Planned`/`Under Construction`):

  | Project | Province | Sector | Status | Last Updated |
  |---|---|---|---|---|
  | Lotte Foods Cambodia | Kandal | Food Processing | Planned | 2026-01-21 |
  | Schaeffler Bearings Plant | Phnom Penh | Electronics | Under Construction | 2026-02-25 |
  | Hyundai-Kefico Assembly Plant | Kampong Speu | Automotive | Under Construction | 2026-03-12 |
  | Wuxi Electronics PCB Plant | Svay Rieng | Electronics | Under Construction | 2026-03-29 |
  | WHA Cold Chain Hub | Kandal | Warehousing | Under Construction | 2026-04-02 |

  Flagged only — not auto-modified, per policy (stale projects may still be valid).

## Open Knowledge Gaps
10 open gaps total:
- `topic_not_covered`: 8 (latest week_of 2026-07-27)
- `no_rag_context`: 1 (latest week_of 2026-06-22)
- `province_missing`: 1 (latest week_of 2026-07-14)

## Recommendation
Core data quality is clean this week — no duplicates, no missing required fields. The most urgent item is verifying the 5 stale Planned/Under Construction projects, starting with **Lotte Foods Cambodia** (6 months without an update) — confirm whether these are still accurate or need a status change. Secondarily, `topic_not_covered` is now the largest open knowledge-gap bucket (8 of 10) — worth a quick review of what users are asking that the RAG index doesn't cover yet.

## Also Flagged (Security)
`public.spatial_ref_sys` has Row Level Security disabled, exposing it fully to the anon/authenticated roles. This is a PostGIS system table (not app data), but it's worth an explicit decision — see remediation SQL below. Not auto-applied.

```sql
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
```
