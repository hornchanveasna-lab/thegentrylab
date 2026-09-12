import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { useSmoothScroll, useReveal } from "@/components/site/Counter";
import { useMapSites } from "@/lib/data";
import type { MapSite } from "@/data/platform";
import { generateSezDocx } from "@/lib/exportSezDocx";

export const Route = createFileRoute("/research/sez-landscape-2026")({
  head: () => ({
    meta: [
      { title: "Cambodia SEZ Landscape 2026 — Free Brief | The Gentry Lab" },
      {
        name: "description",
        content: "Free analysis: Cambodia's 60+ tracked SEZs and industrial parks, scored against the UNIDO Eco-Industrial Park framework — which zones are real, which are paper approvals.",
      },
      { property: "og:title", content: "Cambodia SEZ Landscape 2026 — Free Research Brief" },
      { property: "og:description", content: "60+ SEZs scored. 4 clear Gold tier. Here's what the other 56 actually look like." },
    ],
  }),
  component: SezLandscapeBrief,
});

const EMAIL = "advisory@thegentrylab.io";

function isSezOrPark(s: MapSite) {
  return s.layer === "investment" && (s.kind === "sez" || s.kind === "park");
}

function SezLandscapeBrief() {
  useSmoothScroll();
  useReveal();
  const { data: sites = [] } = useMapSites();

  const zones = useMemo(() => sites.filter(isSezOrPark), [sites]);

  const stats = useMemo(() => {
    const total = zones.length;
    const noStatus = zones.filter((z) => !z.status).length;
    const tierCounts = { Gold: 0, Silver: 0, Bronze: 0, None: 0 };
    zones.forEach((z) => {
      if (z.eip_tier === "Gold") tierCounts.Gold++;
      else if (z.eip_tier === "Silver") tierCounts.Silver++;
      else if (z.eip_tier === "Bronze") tierCounts.Bronze++;
      else tierCounts.None++;
    });
    const byProvince = new Map<string, number>();
    zones.forEach((z) => {
      const p = z.province || "Unknown";
      byProvince.set(p, (byProvince.get(p) ?? 0) + 1);
    });
    const topProvinces = [...byProvince.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
    const topZones = [...zones]
      .filter((z) => typeof z.score === "number")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5);
    const chineseDeveloped = zones.filter((z) =>
      /zhejiang|jiangsu|qilu|shandong|suzhou/i.test(`${z.name} ${z.developer ?? ""}`)
    ).length;
    return { total, noStatus, tierCounts, topProvinces, topZones, chineseDeveloped };
  }, [zones]);

  const pct = (n: number) => (stats.total ? Math.round((n / stats.total) * 100) : 0);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans overflow-x-clip print:bg-white print:text-black">
      <div className="print:hidden">
        <TopNav />
      </div>

      {/* ── Header ── */}
      <section className="relative py-16 md:py-20 border-b border-white/8 print:border-black/20 print:py-6">
        <div className="absolute inset-0 print:hidden" style={{ background: "radial-gradient(ellipse 70% 60% at 30% 0%, #ff510018 0%, transparent 70%)" }} />
        <div className="max-w-4xl mx-auto px-6 md:px-12 relative">
          <div className="flex items-center gap-3 mb-6 print:hidden">
            <Link to="/research" className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-colors">
              ← Research Library
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest border border-[#ff5100]/40 text-[#ff5100] bg-[#ff5100]/10">
              Sector
            </span>
            <span className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest border border-emerald-400/40 text-emerald-400 bg-emerald-400/10">
              Free Preview
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">42-page brief · condensed</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.95] mb-5 print:text-black">
            Cambodia SEZ Landscape 2026
          </h1>
          <p className="text-white/50 leading-relaxed max-w-2xl print:text-black/70">
            A census of every SEZ and industrial park on our live map — which zones have genuine
            infrastructure, which are paper approvals, and where investment is actually landing.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-7 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
              Download as PDF
            </button>
            <button
              onClick={() => generateSezDocx(stats)}
              className="inline-flex items-center gap-2 px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6M9 9h1"/></svg>
              Download as Word
            </button>
            <a
              href={`mailto:${EMAIL}?subject=Advisory%20inquiry&body=I%20read%20the%20SEZ%20Landscape%20brief%20and%20want%20to%20talk.`}
              className="inline-flex items-center gap-2 px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest bg-[#ff5100] text-black hover:brightness-110 transition"
            >
              Talk to advisory
            </a>
          </div>
        </div>
      </section>

      {/* ── Live data strip ── */}
      <section className="border-b border-white/8 bg-[#0d0d0e] print:bg-white print:border-black/20 reveal">
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-8">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-4 print:text-black/40">
            Live from thegentrylab.io/map · updated continuously, not a static PDF snapshot
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { n: stats.total || "—", label: "SEZs & parks tracked" },
              { n: stats.noStatus || "—", label: `No confirmed status (${pct(stats.noStatus)}%)` },
              { n: stats.tierCounts.Gold || "—", label: "Score Gold tier (≥80)" },
              { n: stats.chineseDeveloped || "—", label: "Chinese-developed / linked" },
            ].map((s) => (
              <div key={s.label} className="border border-white/8 px-4 py-3 print:border-black/15">
                <p className="text-2xl font-extrabold tracking-tighter text-[#ff5100] print:text-black">{s.n}</p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mt-1 print:text-black/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <article className="max-w-4xl mx-auto px-6 md:px-12 py-14 space-y-12 print:py-6 print:space-y-8">

        <section className="reveal">
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">The headline number is misleading</h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>
              Cambodia is usually cited as having 71 gazetted SEZs. Our platform actively tracks{" "}
              <strong className="text-white print:text-black">{stats.total || "60+"}</strong> SEZ / industrial-park
              entities with verifiable data — and of those,{" "}
              <strong className="text-white print:text-black">{stats.noStatus} ({pct(stats.noStatus)}%)</strong>{" "}
              have no confirmed operating status: no public update, an unreachable website, or a stale
              Facebook page as the only presence.
            </p>
            <p>
              "71 SEZs" is a CDC approval count. It is not 71 places you can put a factory. That gap is the
              single most important thing a first-time investor needs to understand before reading any
              zone-by-zone pitch deck.
            </p>
          </div>
        </section>

        <section className="reveal">
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            Only {stats.tierCounts.Gold || 4} zones clear Gold tier
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>
              Scoring every zone against the UNIDO / World Bank Eco-Industrial Park framework (management,
              environmental, social, economic pillars), just{" "}
              <strong className="text-white print:text-black">{stats.tierCounts.Gold} of {stats.total} zones score Gold</strong> (≥80).
              Another <strong className="text-white print:text-black">{stats.tierCounts.Silver}</strong> clear Silver. That leaves
              roughly <strong className="text-white print:text-black">{pct(stats.tierCounts.Bronze + stats.tierCounts.None)}%</strong> of
              "SEZs" in Cambodia sitting at Bronze or below — viable for cost-sensitive light manufacturing
              at best, and in a meaningful number of cases, not viable yet at all.
            </p>
          </div>

          {stats.topZones.length > 0 && (
            <div className="mt-6 border border-white/10 overflow-hidden print:border-black/20">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-white/[0.03] print:bg-black/5">
                    <th className="text-left font-mono text-[9px] uppercase tracking-widest text-white/40 px-4 py-2.5 print:text-black/50">Zone</th>
                    <th className="text-left font-mono text-[9px] uppercase tracking-widest text-white/40 px-4 py-2.5 print:text-black/50">Province</th>
                    <th className="text-right font-mono text-[9px] uppercase tracking-widest text-white/40 px-4 py-2.5 print:text-black/50">Score</th>
                    <th className="text-right font-mono text-[9px] uppercase tracking-widest text-white/40 px-4 py-2.5 print:text-black/50">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topZones.map((z, i) => (
                    <tr key={z.id} className={i % 2 ? "bg-white/[0.015]" : ""}>
                      <td className="px-4 py-2.5 text-white/85 font-semibold print:text-black">{z.name}</td>
                      <td className="px-4 py-2.5 text-white/45 print:text-black/60">{z.province}</td>
                      <td className="px-4 py-2.5 text-right text-[#ff5100] font-bold print:text-black">{z.score}</td>
                      <td className="px-4 py-2.5 text-right text-white/45 print:text-black/60">{z.eip_tier ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="reveal">
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">Two clusters carry the whole map</h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>
              Geographically, this isn't {stats.total || "60+"} zones spread evenly across the country — it's
              two dense clusters plus a handful of standouts.{" "}
              {stats.topProvinces.length > 0 && (
                <>
                  <strong className="text-white print:text-black">{stats.topProvinces[0][0]}</strong> alone
                  accounts for <strong className="text-white print:text-black">{stats.topProvinces[0][1]}</strong> tracked
                  zones
                  {stats.topProvinces[1] && (
                    <> — {stats.topProvinces[1][0]} follows with {stats.topProvinces[1][1]}</>
                  )}.
                </>
              )}
            </p>
            <p>
              Svay Rieng's Bavet border corridor is Cambodia's most mature manufacturing cluster, anchored by
              Manhattan SEZ — 50 tenants including Adidas, Puma, Uniqlo and ASICS, exporting an estimated
              $200M/month, roughly 6% of national exports from a single zone. Kampong Speu tells the opposite
              story: a dense cluster of small parks, mostly undocumented, with single-digit scores and no
              confirmed tenants — this is where the "paper approval" problem concentrates most heavily.
            </p>
          </div>
        </section>

        <section className="reveal">
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">The China factor is bigger than headlines suggest</h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>
              At least <strong className="text-white print:text-black">{stats.chineseDeveloped || 8}</strong> of
              the tracked zones are explicitly Chinese-developed or state-linked. This isn't a China-vs-West
              framing problem — it's a practical one: several of the strongest-performing zones on the
              platform (Sihanoukville SEZ, Score 88; the Sihanoukville Zhejiang Guoji zone, Score 75, now at
              full capacity) are Chinese-developed, meaning Western investors evaluating "is this zone
              credible" often need to evaluate Chinese industrial-park track records specifically, not
              generic SEZ criteria.
            </p>
          </div>
        </section>

        <section className="reveal">
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">What separates a real zone from a paper one</h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>
              Looking at what the Gold/Silver-tier zones have in common that the no-status ones lack: a named
              developer with a traceable history, a confirmed tenant count (not just a hectare figure), port
              distance under roughly 35km, and — critically — an operating status update within the last 12
              months. Zones missing two or more of these are the ones scoring below 40, and typically the
              ones with no confirmed status at all.
            </p>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="reveal border-t border-white/10 pt-10 print:hidden">
          <div className="border border-white/10 bg-[#0d0d0e] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-1.5">This was 1 of 11 briefs</p>
              <p className="text-white font-bold text-lg leading-tight">
                Power capacity, permit pathways, cost benchmarks, labor curves — 10 more, plus advisory.
              </p>
            </div>
            <a
              href={`mailto:${EMAIL}?subject=Advisory%20access%20request&body=I%20read%20the%20SEZ%20Landscape%20brief%20and%20want%20access%20to%20the%20full%20library.`}
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 font-mono text-[10px] uppercase tracking-widest bg-[#ff5100] text-black hover:brightness-110 transition"
            >
              Request advisory access
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5h8M5.5 1.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </div>
        </section>

        <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 print:text-black/40">
          Sources: The Gentry Lab site tracker (live), CDC/SEZB public gazette, operator disclosures.
          Scoring: UNIDO/World Bank/GIZ International Framework for Eco-Industrial Parks v2.0.
        </p>
      </article>

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
