# Map Enhancement Agent

**Schedule:** Every Monday 07:00 ICT (UTC+7)  
**Trigger:** `mcp__scheduled-tasks__create_scheduled_task` or Supabase pg_cron  
**Run order:** This agent orchestrates 4 sub-steps in sequence.

---

## Overview

Keeps all 141+ map sites current with fresh satellite imagery, enriched data, accurate strengths/constraints, and recalculated EIP scores. Designed to run fully autonomously with no human input.

---

## Step 1 — Satellite Photo Harvest

**Goal:** Ensure every site with coordinates has at least 2 photos (satellite view + area context).

**Process:**
1. Query `site_images` to find all `site_id`s that already have photos
2. Query `sites` where `lat IS NOT NULL AND lng IS NOT NULL`
3. For each site missing photos, call the `satellite-fetch` Edge Function:
   - Zoom levels by kind: `sez=14`, `park=15`, `factory/powerplant/substation=16`
   - Fetch two shots: close zoom + (zoom − 2) for area context
   - Upload each to Supabase Storage bucket `site-images` at path `satellite/{site_id}/{zoom}-{timestamp}.jpg`
   - Insert into `site_images` with `source = 'google_satellite'`
4. Log count of new photos added

**Edge Function:** `https://mcxfukjopdnouicwacbn.supabase.co/functions/v1/satellite-fetch`  
Params: `?lat={lat}&lng={lng}&zoom={zoom}&size=800x450`  
Key is in server-side secret `GOOGLE_MAPS_KEY` — never stored in DB.

---

## Step 2 — Site Data Enrichment

**Goal:** Update `about`, `notes`, `website`, `operator`, `tenant_count`, `employee_count`, `export_value_usd`, and other detail fields for SEZs and industrial parks.

**Process:**
1. For each site where `kind IN ('sez', 'park')`:
   - Fetch the site's `website` URL if available
   - Also search: `{site.name} Cambodia SEZ investment 2025`
   - Extract and UPDATE in `sites`:
     - `notes` — 3–5 sentence about/description
     - `tenant_count`, `country_count`, `employee_count`
     - `export_value_usd` (annual, USD)
     - `operator`, `year_commissioned`
     - `zone_types` array (e.g. `["Manufacturing", "Logistics"]`)
     - `on_site_facilities` array
     - `airport_distance_km`, `city_distance_km`
     - `data_source_url`, `data_verified_at` (today's date)
2. For energy layer (`kind IN ('powerplant','substation')`):
   - Update `capacity_mw`, `energy_type`, `operator`, `year_commissioned`
3. Log fields updated per site

**Sources to check:**
- Site's own website
- MPEZD Cambodia (`mpezd.gov.kh`)
- CSEZB (`csezb.gov.kh`)
- Open Development Cambodia (`opendevelopmentcambodia.net`)
- JETRO Cambodia investment guides
- News articles from the past 6 months

---

## Step 3 — Strengths & Constraints Restudy

**Goal:** Regenerate `strengths` and `constraints` arrays for every site using current data and the EIP framework.

**Process:**
1. For each site, evaluate against the 4 EIP pillars:

   **Management (25 pts)**
   - Is there a professional operator named?
   - Is there a listed entity or verified governance?
   - Is there a SEZ law / special economic zone status?
   - Is there investor services / one-stop-shop mentioned?

   **Environmental (25 pts)**
   - Is flood risk low? (`flood_risk = false` or elevation > 5m)
   - Are utilities (water/power/waste) described?
   - Is renewable energy or green certification mentioned?
   - Is environmental management plan (EMP) referenced?

   **Social (25 pts)**
   - Is employee count > 500?
   - Are worker facilities (dormitory, canteen, medical) listed?
   - Is it near a labor pool province (Kandal, Kampong Speu, Phnom Penh)?
   - Are training programs or vocational links mentioned?

   **Economic (25 pts)**
   - Is export value > $100M/yr?
   - Are 10+ tenant companies present?
   - Is it near a port or SEZ border gate?
   - Are multiple industry sectors hosted?

2. Generate `strengths` (3–5 bullets, specific to location/data):
   - Use geographic facts: province, distance to port, road access
   - Use operational facts: tenant count, employee count, export value
   - Use infrastructure facts: utilities, grid, facilities

3. Generate `constraints` (2–4 bullets, honest gaps):
   - Missing or incomplete data fields = uncertainty risk
   - High flood risk = operational constraint
   - Remote location with poor road = logistics constraint
   - Low tenant count = ecosystem risk

4. UPDATE `sites` SET `strengths = [...], constraints = [...]`

**Rule:** Never copy strengths/constraints from a different site. Each must reflect the site's own data.

---

## Step 4 — EIP Score Recalculation

**Goal:** Recalculate `eip_management`, `eip_environmental`, `eip_social`, `eip_economic`, and `score` for every SEZ/park.

**Scoring formula** (refer to `site-scoring-engine.md` for full rubric):

| Sub-pillar | Max | Signal field |
|---|---|---|
| Governance & legal | 8 | `operator` not null + SEZ law |
| Services | 5 | `on_site_facilities` length > 3 |
| Transparency | 7 | `data_source_url` + `website` |
| EMS | 8 | `renewable_pct` or energy policy |
| Resource efficiency | 7 | `grid_uptime_pct` > 95 |
| Pollution control | 5 | `utilities` mentions waste/water treatment |
| Labor standards | 8 | `employee_count` > 1000 |
| Community | 7 | province is major labor province |
| Worker welfare | 5 | facilities include dormitory/medical |
| Tenant density | 8 | `tenant_count` > 20 |
| Export performance | 7 | `export_value_usd` > 500M |
| Diversification | 5 | `zone_types` length > 1 |

**Tier assignment:**
- 80–100 → `eip_tier = "EIP+"` (Certified EIP)
- 60–79  → `eip_tier = "Advanced"`
- 40–59  → `eip_tier = "Developing"`
- 0–39   → `eip_tier = "Basic"`

**UPDATE** `sites` SET `eip_management`, `eip_environmental`, `eip_social`, `eip_economic`, `score`, `eip_tier`

---

## Weekly Schedule

```sql
-- Register in Supabase pg_cron (run once to activate):
SELECT cron.schedule(
  'map-enhancement-weekly',
  '0 0 * * 1',  -- every Monday 00:00 UTC = 07:00 ICT
  $$SELECT net.http_post(
    url := 'https://mcxfukjopdnouicwacbn.supabase.co/functions/v1/map-enhancement-runner',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
  )$$
);
```

Or trigger manually from Claude Code:
```
mcp__scheduled-tasks__create_scheduled_task with cron "0 0 * * 1"
```

---

## Output / Logging

After each run, INSERT a row into `research` table:
```json
{
  "title": "Map Enhancement Run — 2026-06-23",
  "category": "Platform Update",
  "abstract": "Added 42 satellite photos, updated 8 SEZ detail records, refreshed 72 strengths/constraints, recalculated 18 EIP scores.",
  "source_url": null,
  "pages": 1
}
```

---

## Dependencies

- `satellite-fetch` Edge Function deployed ✅
- `GOOGLE_MAPS_KEY` secret set in Edge Function secrets (user action)
- `site-images` Storage bucket with public read ✅
- `site_images` table ✅
- `sites` table with all new fields ✅
- Previous agents: `odc-map-harvester`, `map-data-validator`, `site-scoring-engine`
