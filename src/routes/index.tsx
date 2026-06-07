import { createFileRoute, Link } from "@tanstack/react-router";
import { TopNav } from "@/components/site/TopNav";
import { IndustrialMap } from "@/components/site/IndustrialMap";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Gentry Lab — Cambodia Industrial Intelligence Platform" },
      {
        name: "description",
        content:
          "Interactive map of Cambodia's SEZs, factories, infrastructure, utilities and industrial risk. Decision-grade intelligence for foreign manufacturers and investors.",
      },
      { property: "og:title", content: "The Gentry Lab — Cambodia Industrial Intelligence" },
      {
        property: "og:description",
        content:
          "The Bloomberg Terminal for industrial development in Cambodia. Map sites, track projects, evaluate locations.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

const STATS = [
  { value: "54", label: "Active & planned SEZs" },
  { value: "9", label: "Industrial corridors mapped" },
  { value: "110+", label: "Sites on the intelligence map" },
  { value: "12", label: "Active investment projects tracked" },
];

const ROADMAP = [
  "Site Score Engine",
  "Permit Navigator",
  "Utility Capacity Map",
  "Cost Heat Map",
  "Land Marketplace",
  "AI Industrial Advisor",
];

function Index() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <TopNav />

      {/* Hero */}
      <section className="border-b border-white/10 px-6 py-14 md:py-20 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
              Industrial Intelligence Platform · Cambodia
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tighter leading-[0.92] mt-4 max-w-2xl">
              Know Cambodia's{" "}
              <span className="text-brand-accent">industrial</span>{" "}
              landscape before you commit.
            </h1>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <p className="text-white/60 text-sm max-w-xs leading-relaxed">
              Map every SEZ, corridor, substation, and risk zone.
              Click any site for a GentryLab advisory brief.
            </p>
            <Link
              to="/about"
              className="font-mono text-[11px] uppercase tracking-widest text-white/50 hover:text-brand-accent transition"
            >
              About the platform →
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10">
          {STATS.map((s) => (
            <div key={s.label} className="bg-black px-6 py-5">
              <p className="text-3xl font-extrabold tracking-tighter text-brand-accent">
                {s.value}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Map — full viewport height */}
      <section className="border-b border-white/10">
        <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">
            Live Map · 9 Corridors · 5 Layers · Click any site to inspect
          </p>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-brand-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
            Live
          </span>
        </div>
        <IndustrialMap />
      </section>

      {/* Roadmap strip */}
      <section className="border-b border-white/10 bg-black px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
                Roadmap · Phase 02—03
              </p>
              <h2 className="text-2xl font-extrabold uppercase tracking-tighter mt-2">
                Coming next to the platform
              </h2>
            </div>
            <Link
              to="/about"
              className="font-mono text-[11px] uppercase tracking-widest text-white/60 hover:text-brand-accent transition"
            >
              About The Gentry Lab →
            </Link>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-white/10 border border-white/10">
            {ROADMAP.map((r) => (
              <li
                key={r}
                className="bg-black p-4 font-mono text-[11px] uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/5 transition cursor-default"
              >
                {r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-6 font-mono text-[10px] uppercase tracking-widest text-white/40 flex flex-col sm:flex-row justify-between gap-2 max-w-7xl mx-auto">
        <p>© 2026 The Gentry Lab · Phnom Penh</p>
        <p>Industrial Intelligence Platform · v0.1 MVP</p>
      </footer>
    </div>
  );
}
