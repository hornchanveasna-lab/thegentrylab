import { createFileRoute, Link } from "@tanstack/react-router";
import { TopNav } from "@/components/site/TopNav";
import { useSnapScroll } from "@/components/site/Counter";
import { useDataQuality } from "@/lib/data";

export const Route = createFileRoute("/methodology")({
  component: MethodologyPage,
});

const ACCENT = "#ff5100";

const TIERS = [
  { n: 1, label: "Official", color: "#34d399", desc: "Sourced from CDC, SEZB, EDC, operators, or government records." },
  { n: 2, label: "Reputable", color: "#38bdf8", desc: "From Google Places, major media (Nikkei, World Bank), or verified industry sources." },
  { n: 3, label: "Derived / Estimated", color: "#fbbf24", desc: "Manually entered or computed; source not yet documented. Treat as indicative." },
];

const METHODS = [
  { k: "Official", desc: "Taken directly from an authoritative record (e.g. CDC registration, operator filing)." },
  { k: "Measured", desc: "Computed from a real measurement — e.g. road distance via routing API." },
  { k: "Modeled", desc: "From a model/dataset — e.g. operator coverage maps, GloFAS flood hazard." },
  { k: "Estimated", desc: "Straight-line (Haversine) distance or a reasoned approximation. Not road distance." },
  { k: "Derived", desc: "Calculated from other fields (e.g. an EIP score from inputs)." },
];

const SOURCES = [
  ["Administrative boundaries", "GADM 4.1"],
  ["Infrastructure reference points", "PAS / PPAP / OSM (sourced + dated in DB)"],
  ["Flood hazard", "GloFAS / Copernicus EMS (100-yr return period)"],
  ["Mobile coverage", "Operator coverage maps (2023 snapshot)"],
  ["Site coordinates", "Google Places + manual verification"],
  ["EIP scoring framework", "UNIDO / World Bank / GIZ Eco-Industrial Parks v2.0 (2021)"],
];

function Stat({ value, label, sub, color }: { value: string | number; label: string; sub?: string; color?: string }) {
  return (
    <div className="px-6 py-7">
      <p className="text-4xl font-extrabold tracking-tighter tabular-nums" style={{ color: color ?? ACCENT }}>{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1.5">{label}</p>
      {sub && <p className="font-mono text-[9px] text-white/25 mt-0.5">{sub}</p>}
    </div>
  );
}

function MethodologyPage() {
  useSnapScroll();
  const { data: dq } = useDataQuality();

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans overflow-x-clip">
      <TopNav />

      {/* Hero */}
      <section className="snap-section relative py-20 md:py-28 border-b border-white/8 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 60% at 30% 100%, ${ACCENT}20 0%, transparent 70%)` }} />
        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: ACCENT }} />
            <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: ACCENT }}>Data & Methodology</p>
          </div>
          <h1 className="font-extrabold uppercase leading-[0.9] tracking-tighter text-[clamp(2.4rem,6vw,4.5rem)] max-w-3xl">
            How we source,<br />verify & label<br /><span className="text-gradient">every data point.</span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mt-7 leading-relaxed">
            Industrial decisions need data you can defend. Every figure on the platform carries its source, the date it was checked, and how certain it is — and we label estimates as estimates.
          </p>
        </div>
      </section>

      {/* Live data quality */}
      <section className="snap-section border-b border-white/8 bg-[#0d0d0e]">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-1">Live data-quality snapshot</p>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/8 border-t border-white/8">
          <Stat value={dq ? dq.total_sites : "—"} label="Tracked sites" />
          <Stat value={dq ? `${dq.coords_verified_pct}%` : "—"} label="GPS-verified coords" sub={dq ? `${dq.coords_verified}/${dq.total_sites}` : ""} color="#34d399" />
          <Stat value={dq ? dq.tier2_reputable : "—"} label="Tier 2 sourced" color="#38bdf8" />
          <Stat value={dq ? dq.conf_low : "—"} label="Low confidence" sub="being upgraded" color="#fbbf24" />
        </div>
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-3 border-t border-white/8">
          <p className="font-mono text-[9px] text-white/25">
            Updated continuously from the live database. We publish these numbers — including the gaps — on purpose.
          </p>
        </div>
      </section>

      {/* Source tiers */}
      <section className="snap-section px-6 md:px-12 py-16 border-b border-white/8 max-w-5xl mx-auto">
        <h2 className="text-3xl font-extrabold uppercase tracking-tighter mb-3">Source tiers</h2>
        <p className="text-white/45 mb-8 max-w-2xl">Every site is graded by how authoritative its source is. We don't hide tier-3 data — we mark it so you know what still needs corroboration.</p>
        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <div key={t.n} className="border border-white/10 bg-[#0e0e10] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: t.color, backgroundColor: t.color + "18" }}>
                  Tier {t.n} · {t.label}
                </span>
              </div>
              <p className="text-[13px] text-white/55 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Method labels */}
      <section className="snap-section px-6 md:px-12 py-16 border-b border-white/8 bg-[#0d0d0e]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold uppercase tracking-tighter mb-3">How values are derived</h2>
          <p className="text-white/45 mb-8 max-w-2xl">Each field is labeled by method. The distinction that matters most: <span className="text-white/70">estimated</span> (straight-line) is not the same as <span className="text-white/70">measured</span> (road distance).</p>
          <div className="divide-y divide-white/8 border border-white/10">
            {METHODS.map((m) => (
              <div key={m.k} className="grid grid-cols-[120px_1fr] gap-4 px-5 py-4">
                <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: ACCENT }}>{m.k}</span>
                <span className="text-[13px] text-white/55 leading-relaxed">{m.desc}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-white/35 mt-4 leading-relaxed">
            Logistics distances (airport, rail, border) are currently <span className="text-white/60">estimated</span> — straight-line from a sourced reference-points table. Road distances are being upgraded to <span className="text-white/60">measured</span> via routing.
          </p>
        </div>
      </section>

      {/* EIP scoring */}
      <section className="snap-section px-6 md:px-12 py-16 border-b border-white/8 max-w-5xl mx-auto">
        <h2 className="text-3xl font-extrabold uppercase tracking-tighter mb-3">The EIP suitability score</h2>
        <p className="text-white/45 mb-8 max-w-2xl">Site scores (0–100) follow the UNIDO / World Bank / GIZ International Framework for Eco-Industrial Parks (v2.0, 2021), adapted for Cambodia. Four equally-weighted pillars:</p>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            ["Park Management", "Operator, registration, defined area, zone status"],
            ["Environmental", "Elevation/flood risk, utilities, provincial risk"],
            ["Social", "University & TVET proximity, labor pool, access"],
            ["Economic", "Port/rail/border access, road, operational status, scale"],
          ].map(([t, d]) => (
            <div key={t} className="border border-white/10 bg-[#0e0e10] p-5">
              <p className="font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color: ACCENT }}>{t}</p>
              <p className="text-[12px] text-white/50 leading-relaxed">{d}</p>
              <p className="font-mono text-[9px] text-white/25 mt-3">25 pts</p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-white/35 mt-4">Tiers: Gold ≥80 · Silver 65–79 · Bronze 40–64. Scores are <span className="text-white/60">derived</span> — only as good as their inputs, which is why provenance matters.</p>
      </section>

      {/* Sources */}
      <section className="snap-section px-6 md:px-12 py-16 border-b border-white/8 bg-[#0d0d0e]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold uppercase tracking-tighter mb-8">Primary data sources</h2>
          <div className="divide-y divide-white/8 border border-white/10">
            {SOURCES.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[1fr_1.4fr] gap-4 px-5 py-3.5">
                <span className="text-[13px] text-white/70">{k}</span>
                <span className="font-mono text-[11px] text-white/40">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="snap-section py-20 px-6 md:px-12 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tighter mb-6">See it on the map</h2>
        <Link to="/map" className="inline-flex items-center gap-2 px-9 py-4 rounded-full font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all"
          style={{ backgroundColor: ACCENT, color: "#000", boxShadow: `0 0 32px ${ACCENT}55` }}>
          Open the intelligence map
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      </section>
    </div>
  );
}
