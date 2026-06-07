# The Gentry Lab

**Cambodia Industrial Development Intelligence & Advisory Platform**

An interactive intelligence platform for foreign investors, manufacturers, landowners, and development banks navigating Cambodia's industrial landscape.

---

## What It Does

- **Interactive Map** — Explore Cambodia's SEZs, industrial parks, factories, infrastructure, utilities, risk zones, and labor centers across 6 toggleable layers
- **9 Industrial Corridors** — NR1–NR6, Ring Road 3, Airport Corridor, and Port Corridor rendered as live polylines
- **Site Inspector** — Click any site to view a GentryLab advisory brief: suitability score, strengths, constraints, target industries, and strategic recommendation
- **Project Tracker** — Monitor active and planned industrial investments by sector, province, and status
- **News Feed** — Curated industrial intelligence from CDC, Khmer Times, Nikkei Asia, and Reuters
- **Research Library** — Sector briefs, cost benchmarks, regulatory guides, and flood risk atlases

---

## Tech Stack

- [TanStack Start](https://tanstack.com/start) — Full-stack React framework
- [React 19](https://react.dev) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [Leaflet](https://leafletjs.com) + [React-Leaflet](https://react-leaflet.js.org) — Interactive map
- [shadcn/ui](https://ui.shadcn.com) — UI component library
- [Vite](https://vitejs.dev) — Build tool

---

## Getting Started

```bash
npm install --legacy-peer-deps
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── components/
│   ├── site/          # TopNav, IndustrialMap, Footer
│   └── ui/            # shadcn/ui components
├── data/
│   └── platform.ts    # All seed data — sites, corridors, projects, news, research
├── routes/
│   ├── index.tsx      # Home + Map
│   ├── tracker.tsx    # Project Tracker
│   ├── news.tsx       # News Feed
│   ├── research.tsx   # Research Library
│   ├── about.tsx      # About
│   └── contact.tsx    # Contact
└── styles.css         # Tailwind v4 theme tokens
```

---

## Data Sources

All data is illustrative seed data based on public information from:
- Council for the Development of Cambodia (CDC)
- SEZ Board of Cambodia
- Electricité Du Cambodge (EDC)
- Ministry of Public Works and Transport (MPWT)
- Public press releases and news sources

> **Disclaimer:** Data is illustrative. Verify all information before making investment decisions.

---

## Advisory Services

The Gentry Lab provides industrial development advisory services in Cambodia:

- Land selection & SEZ feasibility
- Technical due diligence
- Permit navigation
- Project delivery & EPC management

**Contact:** [thegentrylab.com](https://thegentrylab.com) · Phnom Penh, Cambodia

---

© 2026 The Gentry Lab · Industrial Intelligence Platform · v0.1 MVP
