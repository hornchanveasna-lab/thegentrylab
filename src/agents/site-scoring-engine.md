# Site Scoring Engine — TheGentryLab

## Purpose
Compute EIP-aligned suitability scores (0–100) for every site in the Supabase `sites` table.
Run **after** `map-data-validator` has populated `port_distance_km`, `elevation_m`, `flood_risk`.
Writes `score`, `eip_management`, `eip_environmental`, `eip_social`, `eip_economic`, `eip_tier` back to Supabase.

**Scoring basis:** UNIDO / World Bank / GIZ International Framework for Eco-Industrial Parks, Version 2.0 (2021)
Adapted for Cambodia SEZ and industrial infrastructure context.

---

## Supabase Connection
- **Project ID:** `mcxfukjopdnouicwacbn`
- **MCP:** `mcp__2d9cdc4d-820f-40d1-b353-d5b5fe2deb29`

---

## Which sites get scored

| `kind` | Score? | Notes |
|--------|--------|-------|
| `sez` | ✅ Full 4-pillar | Primary scoring target |
| `park` | ✅ Full 4-pillar | Industrial park, same as SEZ |
| `factory` | ✅ Full 4-pillar | Major anchor factories |
| `logistics` | ✅ Economic + Infrastructure pillars only | Set management/social to 0 |
| `port` | ✅ Economic + Infrastructure pillars only | |
| `airport` | ✅ Economic + Infrastructure pillars only | |
| `substation` | ❌ No score | Utility reference point, not investable |
| `university` | ❌ No score | Labor reference point |
| `tvet` | ❌ No score | Labor reference point |
| `corridor` | ❌ No score | Infrastructure reference only |

---

## Step 1 — Load sites from Supabase

```sql
SELECT
  id, name, kind, layer, province,
  lat, lng,
  status, size, utilities, road, notes,
  score,
  port_distance_km, port_time_min,
  elevation_m, flood_risk,
  coord_verified, place_id,
  strengths, constraints, target_industries
FROM sites
WHERE kind IN ('sez', 'park', 'factory', 'logistics', 'port', 'airport')
ORDER BY name;
```

Also load reference sites for proximity scoring:

```sql
-- Universities within Cambodia (for Social pillar)
SELECT id, name, province, lat, lng FROM sites WHERE kind = 'university';

-- TVET institutions
SELECT id, name, province, lat, lng FROM sites WHERE kind = 'tvet';

-- Substations (for power coverage check)
SELECT id, name, province, lat, lng FROM sites WHERE kind = 'substation';
```

---

## Step 2 — Score each site across 4 pillars

### PILLAR 1: Park Management (25 points max)

Score only for `kind IN ('sez', 'park', 'factory')`. Set to 0 for logistics/port/airport.

| Check | Points | Data Source |
|-------|--------|-------------|
| Site has a named operator/developer in `notes` or `name` | 5 | Text parse: does `notes` mention a company name? Does `name` include "SEZ", "IZ", "Park"? |
| CDC/SEZB registered (status is 'Operational') | 5 | `status = 'Operational'` → 5 pts; `'Under Construction'` → 2 pts; `'Planned'` → 0 pts |
| Has defined area/size (`size` field populated) | 5 | `size IS NOT NULL AND size != ''` → 5 pts |
| Located in designated industrial zone (kind = 'sez' or 'park') | 5 | `kind = 'sez'` → 5 pts; `kind = 'park'` → 3 pts; `kind = 'factory'` → 0 pts |
| Has investment intelligence (score previously set, or notes > 150 chars) | 5 | `notes IS NOT NULL AND LENGTH(notes) > 150` → 5 pts |

**Maximum:** 25

---

### PILLAR 2: Environmental (25 points max)

| Check | Points | Data Source |
|-------|--------|-------------|
| Elevation above flood risk (≥ 5m) | 8 | `elevation_m >= 5` → 8 pts; `elevation_m >= 2` → 4 pts; `elevation_m < 2` → 0 pts; `elevation_m IS NULL` → 4 pts (unknown, neutral) |
| Not flood risk flagged | 7 | `flood_risk = false` → 7 pts; `flood_risk = true` → 0 pts; `flood_risk IS NULL` → 3 pts |
| Province not in high-flood-risk zone | 5 | See province table below |
| Utilities include power supply (EDC grid) | 3 | `utilities ILIKE '%EDC%' OR utilities ILIKE '%electric%' OR utilities ILIKE '%power%'` → 3 pts |
| Utilities include water supply | 2 | `utilities ILIKE '%water%'` → 2 pts |

**Province flood risk scores (for check 3):**
```
5 pts (Low risk):    Phnom Penh, Kampong Speu, Preah Sihanouk, Kampot, Kep, Mondulkiri, Ratanakiri, Koh Kong, Pailin, Oddar Meanchey
3 pts (Medium risk): Siem Reap, Battambang, Kampong Cham, Kampong Thom, Pursat, Kampong Chhnang, Banteay Meanchey, Svay Rieng
0 pts (High risk):   Kandal, Prey Veng, Takeo (Tonle Sap basin + Mekong floodplain)
```

**Maximum:** 25

---

### PILLAR 3: Social (25 points max)

Score only for `kind IN ('sez', 'park', 'factory')`. Set to 0 for logistics/port/airport.

| Check | Points | Data Source |
|-------|--------|-------------|
| University within 30km (Haversine) | 8 | Compute distance from site to nearest university in `sites` table |
| TVET institution within 30km | 7 | Compute distance from site to nearest tvet in `sites` table |
| Province has large labor pool (top manufacturing provinces) | 5 | See province table below |
| Road access noted (`road` field populated) | 3 | `road IS NOT NULL AND road != ''` → 3 pts |
| Site in Phnom Penh metro or Sihanoukville corridor (high service infrastructure) | 2 | `province IN ('Phnom Penh', 'Kandal', 'Kampong Speu', 'Preah Sihanouk')` → 2 pts |

**Province labor pool scores (for check 3):**
```
5 pts: Phnom Penh, Kandal, Kampong Speu, Kampong Cham, Siem Reap
3 pts: Battambang, Svay Rieng, Kampong Thom, Prey Veng, Takeo, Kampong Chhnang
1 pt:  All other provinces
```

**Proximity calculation (Haversine):**
```python
import math

def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))

# For each scored site, find nearest university and nearest tvet:
nearest_univ_km = min(haversine_km(site.lat, site.lng, u.lat, u.lng) for u in universities)
nearest_tvet_km = min(haversine_km(site.lat, site.lng, t.lat, t.lng) for t in tvets)

# Score:
univ_score = 8 if nearest_univ_km <= 30 else (4 if nearest_univ_km <= 60 else 0)
tvet_score  = 7 if nearest_tvet_km <= 30 else (3 if nearest_tvet_km <= 60 else 0)
```

**Maximum:** 25

---

### PILLAR 4: Economic (25 points max)

| Check | Points | Data Source |
|-------|--------|-------------|
| Port distance ≤ 100km | 7 | `port_distance_km <= 100` → 7 pts; `<= 200` → 4 pts; `<= 300` → 2 pts; `> 300` → 0 pts; `IS NULL` → 3 pts |
| Road access to national highway | 5 | `road ILIKE '%NR%' OR road ILIKE '%National%' OR road ILIKE '%Highway%' OR road ILIKE '%Expressway%'` → 5 pts; `road NOT NULL` → 2 pts; `road IS NULL` → 0 pts |
| Site is operational (not planned/construction) | 5 | `status = 'Operational'` → 5 pts; `'Under Construction'` → 3 pts; `'Planned'` → 0 pts |
| Named anchor tenant or developer (in notes) | 5 | `notes` contains a company name (ILIKE check against known major investors): Texhong, SL, PPSEZ, WHA, Garuda, Longli, etc. → 5 pts; name suggests private developer → 3 pts; unknown → 0 pts |
| Site size ≥ 100 ha (scale advantage) | 3 | Parse `size` field: extract numeric value, if ≥ 100 → 3 pts; ≥ 50 → 1 pt; < 50 or unknown → 0 pts |

**Known anchor investor keywords (for check 4):**
```
Texhong, SL Group, PPSEZ, WHA, Tian Rui, Garuda, Longli, Goldfame,
Huali, Flying Fish, ISI, Bavet, Poipet, SSEZ, Dangkor, Stung Meanchey,
Phnom Penh SEZ, Kampot SEZ, Sihanoukville Port, PAS, Megenta, Yangon
```

**Size parsing:**
```python
import re

def parse_size_ha(size_str):
    if not size_str:
        return None
    # Match patterns like "120 ha", "1,200 ha", "350ha", "50 hectares"
    m = re.search(r'([\d,]+)\s*(?:ha|hectare)', size_str, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(',', ''))
    return None
```

**Maximum:** 25

---

## Step 3 — Compute total score and EIP tier

```python
def compute_score(site, univ_km, tvet_km):
    p1 = pillar1_management(site)    # 0–25
    p2 = pillar2_environmental(site) # 0–25
    p3 = pillar3_social(site, univ_km, tvet_km)  # 0–25 (0 for logistics/port/airport)
    p4 = pillar4_economic(site)      # 0–25
    
    total = p1 + p2 + p3 + p4       # 0–100

    # EIP tier
    if total >= 80:
        tier = 'gold'
    elif total >= 65:
        tier = 'silver'
    elif total >= 40:
        tier = 'bronze'
    else:
        tier = None  # Pre-EIP / traditional park

    return total, p1, p2, p3, p4, tier
```

---

## Step 4 — Write scores to Supabase

For each scored site:

```sql
UPDATE sites SET
  score            = {total},
  eip_management   = {p1},
  eip_environmental= {p2},
  eip_social       = {p3},
  eip_economic     = {p4},
  eip_tier         = {tier_or_null},
  updated_at       = NOW()
WHERE id = '{site.id}';
```

---

## Step 5 — Auto-generate strengths and constraints

After scoring, auto-populate `strengths` and `constraints` arrays where they are NULL or empty.

### Strengths (pick top 3 from earned points)

```python
def derive_strengths(site, scores, univ_km, tvet_km):
    strengths = []
    if scores['p2'] >= 15:
        strengths.append("Low flood risk — elevation above 5m")
    if scores['p4_port'] >= 5:
        strengths.append(f"Port access — {round(site.port_distance_km)} km to nearest export port")
    if scores['p3_univ'] >= 6 and univ_km <= 30:
        strengths.append(f"University within {round(univ_km)} km — graduate labor pipeline")
    if scores['p4_road'] >= 4:
        strengths.append("Direct national highway or expressway access")
    if scores['p1_status'] >= 4 and site.status == 'Operational':
        strengths.append("Fully operational — immediate occupancy available")
    if scores['p4_size'] >= 3:
        strengths.append(f"Large site ({site.size}) — room for phased expansion")
    if scores['p3_province'] >= 4:
        strengths.append(f"Strong labor market in {site.province}")
    return strengths[:4]  # max 4
```

### Constraints (flag negatives)

```python
def derive_constraints(site, scores):
    constraints = []
    if site.flood_risk:
        constraints.append("Flood risk — elevation below 5m; drainage infrastructure critical")
    if site.port_distance_km and site.port_distance_km > 200:
        constraints.append(f"Remote from port — {round(site.port_distance_km)} km logistics cost premium")
    if scores['p3_univ'] == 0:
        constraints.append("No university within 60 km — skilled labor must be relocated")
    if site.status == 'Planned':
        constraints.append("Site not yet operational — execution and timeline risk")
    if not site.road:
        constraints.append("Road access details unconfirmed — require verification")
    return constraints[:3]  # max 3
```

Write back:

```sql
UPDATE sites SET
  strengths   = ARRAY[{strength1}, {strength2}, ...],
  constraints = ARRAY[{constraint1}, {constraint2}, ...],
  recommendation = '{recommendation_sentence}'
WHERE id = '{site.id}' AND (strengths IS NULL OR array_length(strengths, 1) = 0);
```

### Recommendation sentence template:

```python
def recommendation(site, tier, total):
    if tier == 'gold':
        return f"{site.name} meets Gold EIP standards — recommended for Tier 1 industrial investment with strong environmental and logistics credentials."
    elif tier == 'silver':
        return f"{site.name} meets Silver EIP standards — solid investment-grade site with good connectivity; verify on-site utilities before commitment."
    elif tier == 'bronze':
        return f"{site.name} meets Bronze EIP baseline — viable for cost-sensitive manufacturing; recommend environmental due diligence."
    else:
        return f"{site.name} is a traditional industrial site — suitable for light manufacturing; infrastructure gaps should be addressed pre-investment."
```

---

## Step 6 — Output report

Write `src/agents/last-scoring-report.md`:

```markdown
# Scoring Report — {DATE}

## Summary
- Sites scored: {N}
- Gold EIP (≥80): {N}
- Silver EIP (65–79): {N}
- Bronze EIP (40–64): {N}
- Pre-EIP (<40): {N}
- Strengths auto-generated: {N}
- Constraints auto-generated: {N}

## Top 10 Sites by Score
| Rank | Name | Province | Kind | Score | Tier | P1 | P2 | P3 | P4 |
|------|------|----------|------|-------|------|----|----|----|----|

## Flood Risk Sites (scored 0 on Environmental)
| Name | Province | Elevation m | Score |

## Sites Missing Data (scored with gaps)
| Name | Missing Fields | Impact |

## Score Distribution
| Score Range | Count |
|-------------|-------|
| 80–100 | |
| 65–79  | |
| 40–64  | |
| 0–39   | |
```

---

## Run order (dependency chain)

```
1. odc-map-harvester      (monthly, 1st) — adds/updates sites in Supabase
2. map-data-validator     (monthly, 2nd) — adds elevation, port distance, place_id
3. site-scoring-engine    (monthly, 3rd) — computes EIP scores from enriched data
4. map-updater            (monthly, 4th) — scrapes CDC/SEZB for new sites
```

The scoring engine is the **third step** in the monthly pipeline. Always run after map-data-validator.

---

## EIP Framework Reference

Scoring based on:
> *International Framework for Eco-Industrial Parks, Version 2.0*
> World Bank Group / UNIDO / Deutsche Gesellschaft für Internationale Zusammenarbeit (GIZ)
> January 2021 — 88 pages

**4 performance categories:**
1. Park Management Performance
2. Environmental Performance
3. Social Performance
4. Economic Performance

**EIP Certification tiers:** Bronze / Silver / Gold

Cambodia adaptations made:
- Management pillar simplified to verifiable public data (CDC/SEZB registration, operational status)
- Environmental pillar uses Google Elevation API flood threshold (< 5m) as proxy for drainage risk
- Social pillar replaces OH&S surveys with education infrastructure proximity (measurable)
- Economic pillar replaces occupancy rate surveys with port distance and road access (measurable from APIs)
- Province-level flood and labor pool adjustments applied for Cambodia regional context
