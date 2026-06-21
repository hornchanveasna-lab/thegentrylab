# Official Record Verifier (Tier-1 Upgrader) — TheGentryLab

## Purpose
Upgrade sites from Tier 2/3 to **Tier 1 (official)** by confirming their core
facts against authoritative government/operator records and storing the proof.
Run quarterly, or on-demand after new CDC SEZ approvals.

> Must run in an environment that can reach `cdc.gov.kh`, `edc.com.kh`, etc.
> (the dev sandbox is blocked — 403). Run from the user's machine / CI.

## Supabase
- Project ID: `mcxfukjopdnouicwacbn` · MCP: `mcp__2d9cdc4d-820f-40d1-b353-d5b5fe2deb29`

## Tier-1 criteria (ALL must hold)
1. `data_source_url` resolves to an **official record** for this exact site.
2. At least the core fields are confirmed equal to that record:
   name, developer/operator, province, area (ha), status (and sub-decree for SEZs).
3. `data_verified_at` = today; `source_tier` = 1.
4. `field_provenance` updated: each confirmed field → `{method:'official', source:<url>, at:<YYYY-MM>}`.
5. If a stored value disagrees with the official record → **correct it**, and log the change.

## Authoritative sources by site kind
| kind | Source | URL pattern / entry |
|------|--------|---------------------|
| sez | CDC | `https://cdc.gov.kh/sez/sez-<slug>/`; index: `https://cdc.gov.kh/sez-smart-search/`; CIB: `https://cib-cdc.gov.kh/en/sez` |
| sez | Establishment sub-decree (Anukret) | linked from the CDC SEZ page / gazette |
| substation, powerplant | EDC | `https://www.edc.com.kh/` |
| university, tvet | MoEYS | ministry institution lists |
| port | Authority | PAS `sihanoukvilleport.com.kh`, PPAP `ppap.com.kh` |
| airport | Operator | `techo-airport.gov.kh`, `siemreapairport.com` |
| factory | Operator / QIP | company investor-relations + CDC QIP approval list |

## Process (per site, prioritise kind='sez')
1. **Find the official page.** For SEZs, try `cdc.gov.kh/sez/sez-<slug>/`; if 404,
   use SEZ Smart Search to locate the correct slug. Confirm it's the same zone
   (province + developer match).
2. **Extract official fields:** developer, area_ha, province, status, sub-decree
   no., tenant_count if listed.
3. **Compare** to the stored row. Note any diffs.
4. **Write** via MCP:
   ```sql
   UPDATE sites SET
     source_tier = 1,
     confidence = CASE WHEN coord_verified THEN 'high' ELSE 'medium' END,
     data_source_url = '<official url>',
     data_verified_at = now(),
     -- correct any fields that disagreed:
     size = '<official area> ha',  status = '<official status>',  operator = '<official developer>',
     field_provenance = field_provenance
       || jsonb_build_object(
            'operator', jsonb_build_object('method','official','source','<url>','at','<YYYY-MM>'),
            'size',     jsonb_build_object('method','official','source','<url>','at','<YYYY-MM>'),
            'status',   jsonb_build_object('method','official','source','<url>','at','<YYYY-MM>'))
   WHERE id = '<site id>';
   ```
   Note: coordinates usually stay `measured` (Places) — official pages rarely
   give GPS. Tier reflects the **record** source, not the coordinate.
5. **Never downgrade.** If already Tier 1 with a working source, only refresh
   `data_verified_at` and fix drift.

## Output
Append to `src/agents/last-validation-report.md`:
```markdown
## Tier-1 upgrades — {DATE}
- Upgraded to Tier 1: {N} (list ids)
- Field corrections from official records: {N} (field: old → new, source)
- Could not verify (no official record found): {N}
- New data_quality_summary.tier1_official: {N}
```

## Quick wins (do these first)
The ~31 CDC-registered SEZs are the highest-value Tier-1 targets and the easiest
(each has a dedicated CDC page). Knock those out before factories/universities.
A compiled fallback if CDC is slow: EuroCham "Alternative Manufacturing & SEZ
Guidebook 2024" and the ODC "List of SEZ" resource both cite official figures.
