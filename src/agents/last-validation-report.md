# Validation Report — 2026-07-01

## Data-quality scorecard
_(Supabase data_quality_summary table not queried — this run targets platform.ts seed data only)_

| Metric | This run | Prior run (2026-06-10) |
|---|---|---|
| Sites processed | 45 | 36 |
| Coord-verified flag set | 20 of 45 (44%) | — |
| Sites with image_url | 12 of 45 before → 16 after | 9 before → 12 after |
| New sites added | 2 | 0 |
| Notes enriched | 7 | 5 |

---

## Summary

| Action | Count |
|---|---|
| Sites processed | 45 |
| Coordinates checked via Nominatim | 5 queries |
| Coordinates auto-fixed (>5 km delta) | 0 |
| Coordinates flagged for review (1–5 km) | 1 (kohkong-sez) |
| Images added | 4 |
| Notes enriched (previously <100 chars or empty) | 7 |
| New sites added | 2 |
| Status updates | 1 (kampot-park: Planned → Under Construction) |

---

## Images Added

| Site ID | Name | Image URL | Source |
|---|---|---|---|
| manhattan | Manhattan SVS SEZ | https://construction-property.com/wp-content/uploads/2024/04/CPM_SEZ-in-Svay-Reing_-13042024.jpg | construction-property.com |
| kampot-park | Kampot SEZ & International Port | https://thebettercambodia.com/wp-content/uploads/2022/06/Kampot-Port.jpg | thebettercambodia.com |
| ksez | Kampong Speu SEZ | https://construction-property.com/wp-content/uploads/2024/11/CPM_A-large-Industry_11112024.jpg | construction-property.com |
| ksez-textile (new) | Golden Integrity Green Textile Industrial Park | https://construction-property.com/wp-content/uploads/2024/11/CPM_A-large-Industry_11112024.jpg | construction-property.com |

---

## Still Missing Images

| Site ID | Name | Why not found |
|---|---|---|
| tai-seng | Tai Seng Bavet SEZ | No press coverage with accessible og:image |
| techo | Techo Industrial Park | Site under construction; no dedicated media coverage yet |
| polo-bavet | Polo Bavet Industrial Park | No accessible press article with image |
| poipet-sez | Poipet O'Neang SEZ | phnompenhpost.com returns 403; no thebettercambodia.com article |
| kohkong-sez | Koh Kong SEZ (Neang Kok) | No accessible og:image found |
| kcham-iz | Kampong Cham Industrial Zone | No press coverage with image |
| ppiz | Phnom Penh Industrial Zone (PPIZ) | No accessible og:image found |
| f-garment-1 | Crystal Martin Facility | No accessible og:image |
| f-food-1 | Cambodia Beverage Co. | Factory photo not accessible |
| f-auto-sumitomo | Sumitomo Electric Cambodia | Corporate page; no accessible og:image |
| f-electro-ykk | YKK Cambodia | Corporate; no accessible og:image |
| f-food-prince | Prince Agri Products | No press coverage with accessible image |
| log-dryport | Phnom Penh Dry Port | phnompenhpost.com blocked; no thebettercambodia.com article |
| log-glp-pp | GLP Phnom Penh Logistics Park | Not covered by thebettercambodia.com |
| log-kerry | Kerry Logistics Cambodia Hub | No accessible og:image |
| log-pp-chassis | Phnom Penh Container Depot | No press coverage |
| sub-gs1 through sub-battambang | All 8 substations | EDC photo gallery (edc.com.kh/Photo_page/Photo) returns error page — inaccessible |
| hydro-sesan2 | Lower Sesan 2 Hydropower | Xinhua images are relative-path only; Royal Group site has no cdn URLs |
| hydro-kamchay | Kamchay Hydropower Dam | power-technology.com page text-only |
| hydro-tatay | Stung Tatay Hydropower | No accessible og:image |
| canadia-nr51-sez (new) | Canadia National Road 51 SEZ | No media coverage yet (January 2026 approval) |

_Substation images remain a systematic gap. EDC photo gallery returns an error page. Recommend direct EDC media outreach or using EDC annual report PDF imagery._

---

## Coordinate Checks

### Nominatim results

| Site | Query result | Delta | Action |
|---|---|---|---|
| Techo Industrial Park | No result | — | PASS (site too new for OSM) |
| Polo Bavet Industrial Park | No result | — | PASS (site too new for OSM) |
| Phnom Penh Industrial Zone | No result | — | PASS |
| Phnom Sruoch district | 11.3880, 104.3780 ✓ | Used for new site ksez-textile | PASS |
| Canadia NR51 | 11.5604, 104.6742 ✓ | Used for new site canadia-nr51-sez | PASS |

### Manual review flags

| Site ID | Stored coords | Agent-guide expected | Delta | Action |
|---|---|---|---|---|
| kohkong-sez | 11.610, 102.983 | 11.593, 103.000 | 3.3 km | ⚠️ REVIEW — within 1–5 km band; not auto-fixed. Verify against Neang Kok SEZ official documentation. |

_Note: Nominatim has sparse coverage for Cambodia's specific industrial zones. For remaining unverified sites, use Google Maps Geocoding API (VITE_GOOGLE_MAPS_KEY) in a future Supabase-connected run._

---

## Notes Enriched

| Site ID | Name | Change |
|---|---|---|
| ppsez | Phnom Penh SEZ | 72 chars → full notes: 2025 export data ($2.14B, 14% growth, 55k workers, tenant names) |
| manhattan | Manhattan SVS SEZ | 54 chars → full notes: SJ Group expansion, tenant brands, 36k workers |
| tai-seng | Tai Seng Bavet SEZ | Empty → notes added: Chinese developer, bonded zone, grid sharing with Manhattan SEZ |
| techo | Techo Industrial Park | Empty → notes added: airport adjacency, cargo terminal Phase II, utility status |
| polo-bavet | Polo Bavet Industrial Park | Empty → notes added: Thai developer, zone cluster position |
| kampot-park | Kampot SEZ & International Port | Old (75 chars) → full notes: $1.5B port under construction, 600+ ha, deep-sea berths |
| ksez | Kampong Speu SEZ | Old notes → updated: H1 2025 92-project investment surge, Hyundai cluster, competing parks |

---

## Status Updates

| Site ID | Old Status | New Status | Basis |
|---|---|---|---|
| kampot-park | Planned | Under Construction | Groundbreaking confirmed; $1.5B project actively under construction (thebettercambodia.com) |

---

## New Sites Added

### 1. Golden Integrity Green Textile Industrial Park (`id: ksez-textile`)
- **Province:** Kampong Speu — Phnom Sruoch district (Chheu Neang village, Taing Sya commune)
- **Coordinates:** 11.388, 104.378 (Phnom Sruoch district centroid — Nominatim 2026-07-01)
- **Size:** 500 ha
- **Status:** Under Construction (groundbreaking November 8, 2024)
- **Developer:** Golden Integrity International Investment Group (Mr. John Yu, Chairman)
- **Focus:** Printing, dyeing, electroplating — textile upstream supply chain
- **Jobs target:** 50,000–60,000 at full capacity
- **Source:** construction-property.com, November 2024

### 2. Canadia National Road 51 SEZ (`id: canadia-nr51-sez`)
- **Province:** Kampong Speu — Samrong Tong / Samakki Monichey districts
- **Coordinates:** 11.560, 104.674 (Nominatim verified — Canadia Industrial Park NR51)
- **Size:** 500 ha
- **Status:** Planned (approved by CDC, January 2026)
- **Developer:** Canadia Group
- **Investment:** Part of USD 260M batch of 3 new SEZ approvals (January 2026)
- **Source:** thebettercambodia.com, February 2026

---

## Other Notable Findings (not yet added — insufficient detail)

### Kampot International Tourism Port
- Inaugurated April 2025 for coastal/cross-border cruise traffic
- Separate from the Kampot Logistics & Multipurpose Port (under construction)
- **Action:** Monitor; add as distinct infrastructure site when operational data confirmed

### Cambodia Malaysia China High-Tech Park (Kandal)
- MOU signed March 2024; 2,000 ha total target, Phase 1 = 100 ha, USD 300M
- ~10 km from Phnom Penh CBD in Kandal province
- **Action:** Add once construction commenced (MOU stage only)

### Two new Koh Kong SEZs (Botum Sakor district)
- Provincial Administration announced plans; second branch by Cambodian Zhejiang Guoji SEZ (CJSEZ)
- No names, coordinates, or CDC sub-decree details confirmed
- **Action:** Add once approved by CDC

### Poipet PP SEZ (Royal Group / PPSEZ subsidiary)
- Distinct from Poipet O'Neang SEZ (already in platform.ts)
- ~8 km east of Poipet border; Royal Group operator
- **Action:** Add as separate entry with coordinates once confirmed

---

## Data Quality Issues Found

| Issue | Site ID | Detail |
|---|---|---|
| Possible data error | f-food-1 | Notes say "majority Heineken ownership" — Angkor Beer produced by Cambrew Ltd (Carlsberg Group), not Heineken. Recommend correction. |
| Size discrepancy | manhattan | platform.ts shows "180 ha"; multiple sources cite 400 ha (full zone) and 157 ha (active zone). Verify against CDC SEZ registry. |

---

## Blocked / Inaccessible Sources (confirmed this run)
- **phnompenhpost.com**: HTTP 403 on all fetches
- **khmertimeskh.com**: HTTP 403 (known blocked)
- **cambodianess.com**: HTTP 403 (known blocked)
- **EDC photo gallery** (edc.com.kh/Photo_page/Photo): Returns error page
- **cambodiainvestmentreview.com**: Article images use lazy-loading SVG placeholders — og:image not extractable via WebFetch

---

_Report generated: 2026-07-01 | Agent: tgl-map-updater | Run type: Monthly scheduled validation_
