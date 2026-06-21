# Map area-layer data sources

Boundary layers are bundled here as static GeoJSON (WGS84) and rendered by the
`AreaGeoJsonLayer` in `src/components/site/IndustrialMap.tsx`.

## Already bundled
| File | Layer | Source |
|---|---|---|
| `provinces.json` | Provinces (25) | GADM 4.1 |
| `districts.json` | Districts (202) | GADM 4.1 |

Regenerate with: `node scripts/process-geo.mjs /tmp public/geo`
(after downloading `gadm41_KHM_1.json` / `gadm41_KHM_2.json` from geodata.ucdavis.edu)

## To add (ODC datasets) — download → process → enable

The OD Mekong / ODC datasets below each have a **Download → GeoJSON** button on
their dataset page. Download the GeoJSON, rename to the key below, and drop into
`scripts/geo-incoming/`, then run `node scripts/process-odc.mjs`.

| Save as | Layer key | ODC dataset page |
|---|---|---|
| `protected.geojson` | `protected` | https://data.opendevelopmentcambodia.net/dataset/protected-areas |
| `elc.geojson` | `elc` | https://data.opendevelopmentcambodia.net/dataset/economiclandconcessions |
| `powergrid.geojson` | `powergrid` | https://data.opendevelopmentcambodia.net/dataset/power-transmission-lines-of-cambodia |
| `mining.geojson` | `mining` | https://data.opendevelopmentcambodia.net/dataset/mining (economic mining licenses) |

> Dataset slugs may differ slightly — if a link 404s, search the title at
> https://data.opendevelopmentcambodia.net/dataset and use the GeoJSON resource.

After processing, set `available: true` for that layer in `AREA_LAYERS`
(`src/components/site/IndustrialMap.tsx`). It then appears in the Area Data
panel with its own toggle, opacity slider, and legend entry automatically.

## Notes
- Coordinates are rounded to 4 decimals (~11 m) on import to keep files small.
- The processor auto-detects the display-name field and keeps a few useful
  attributes (company, type, status, area, province, voltage) for click popups.
- All layers expect EPSG:4326 (WGS84) GeoJSON — ODC exports this directly.
