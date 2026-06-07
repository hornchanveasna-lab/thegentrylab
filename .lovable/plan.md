# The Gentry Lab — Industrial Intelligence Platform (Phase 1 MVP)

Reposition the site from a single-page brand brochure into a working **Cambodia Industrial Intelligence Platform**. Phase 1 ships four functional surfaces with curated seed data. Phases 2–3 appear as a roadmap.

## Information architecture

```text
/                → Platform home (flagship Industrial Map + intro)
/tracker         → Industrial Project Tracker (filterable list + map)
/news            → Industrial News feed (seeded articles)
/research        → Research Library (downloadable briefs + insights)
/about           → Founder + advisory positioning (current landing condensed)
/contact         → Engagement inquiry
```

Persistent top nav across all routes. Noir & Gold theme retained. Each route gets its own `head()` metadata.

## 1. Flagship: Cambodia Industrial Map (`/`)

Full-bleed Leaflet + OpenStreetMap basemap of Cambodia, dark-tile styled to match Noir & Gold. Layer control panel (left or floating) with toggles for the five layer groups:

- **Investment** — existing factories, new projects, industrial parks, SEZs, logistics hubs
- **Infrastructure** — national roads, expressways, railways, ports, airports
- **Utilities** — EDC substations, transmission lines, water, wastewater
- **Risk** — flood zones, environmental constraints, land-ownership risk
- **Labor** — population density, universities, TVET centers

Click any marker → right-side **site inspector drawer** showing: name, type, province, size, utilities, road access, status, and a "suitability snapshot" (static scoring for seed sites). Includes search box + province filter.

Above-the-fold hero strip overlays the map briefly with platform tagline + "Explore the map" CTA, then collapses to a slim header so the map is the product.

## 2. Industrial Project Tracker (`/tracker`)

Split view: filterable list (left) + mini-map (right).

- Filters: sector (Garment, Electronics, Food, Warehousing, Data Center), province, status (Planned / Under Construction / Operational), investor origin.
- Each row: project name, sector chip, province, size, investor, status, last update.
- Click → detail panel with same fields plus timeline and source notes.

## 3. Industrial News (`/news`)

Seeded feed of 8–12 curated industrial news cards (SEZ launches, factory openings, infra projects). Each card: headline, source, date, sector tag, summary, outbound link. Filter by sector and province.

## 4. Research Library (`/research`)

Grid of research briefs: "Cambodia SEZ Landscape 2026", "Power Capacity by Province", "Permit Pathway Overview", etc. Each card: title, category, length, abstract, "Request access" CTA (mailto for MVP — no auth/gating system).

## 5. Roadmap teaser (footer on `/`)

Compact section: "Coming next — Site Score Engine · Permit Navigator · Utility Capacity Map · Cost Heat Map · AI Advisor." Visually communicates the bigger vision without committing build scope.

## Design system

Keep the existing Noir & Gold tokens (`#0a0a0b` background, `#ff5100` accent, JetBrains Mono for data). Add:

- Map dark tile styling (CartoDB Dark Matter, free with OSM attribution)
- Data-dense card style for tracker rows and research briefs
- Layer-toggle panel pattern (checkbox + colored swatch)
- Site-inspector drawer pattern (right slide-in)

## Technical notes

- **Map**: `react-leaflet` + `leaflet` (no API key required). Tiles from CartoDB Dark Matter via OSM. Marker icons styled as small gold/orange dots with sector glyphs.
- **Data**: Single `src/data/` module with typed seed arrays — `sites.ts`, `infrastructure.ts`, `utilities.ts`, `projects.ts`, `news.ts`, `research.ts`. ~20–40 realistic entries each, sourced from public knowledge (CDC, SEZ list, EDC, MPWT). Clearly marked as illustrative until live data is wired.
- **Routes**: New TanStack route files `tracker.tsx`, `news.tsx`, `research.tsx`, `about.tsx`, `contact.tsx`. Current rich landing content is moved to `/about`. Index becomes the map-first platform home.
- **Components**: `MapShell`, `LayerControl`, `SiteInspector`, `TrackerTable`, `NewsCard`, `ResearchCard`, `TopNav`, `Footer`.
- **SSR**: Leaflet is browser-only; wrap the map in a client-only mount (mount after `useEffect`) to avoid SSR `window` errors.
- **No backend** this iteration (per "Curated seed data"). Lovable Cloud not enabled.

## Out of scope (Phase 2/3, shown as roadmap only)

Site Score Engine, Cost Heat Map, Permit Navigator, Utility Capacity Map, Land Marketplace, Benchmark Dashboard, AI Advisor, user accounts, CMS/admin, real-time data ingestion.

## Acceptance

- Map loads on `/`, all five layer groups toggle, clicking a marker opens the inspector.
- `/tracker`, `/news`, `/research` render seeded content with working filters where specified.
- Nav works across all routes; current brand/founder content preserved at `/about`.
- No console errors; SSR build passes.
