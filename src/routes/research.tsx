import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { RESEARCH } from "@/data/platform";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "Research Library — The Gentry Lab" },
      {
        name: "description",
        content:
          "Proprietary research briefs on Cambodia industrial development: SEZ landscape, power capacity, permit pathways and cost benchmarks.",
      },
      { property: "og:title", content: "Cambodia Industrial Research Library" },
      { property: "og:description", content: "Decision-grade research for foreign investors." },
    ],
  }),
  component: ResearchPage,
});

function ResearchPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      <TopNav />
      <main className="flex-1 px-6 py-10 max-w-6xl mx-auto w-full">
        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
            Research Library
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tighter mt-2">
            Decision-grade briefs
          </h1>
          <p className="text-white/60 max-w-2xl mt-3 text-sm leading-relaxed">
            Proprietary research from the field, not desk-research summaries.
            Briefs are written for investment committees, not analysts.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-px bg-white/10 border border-white/10">
          {RESEARCH.map((r) => (
            <article key={r.id} className="bg-black p-6 flex flex-col">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">
                <span className="px-2 py-0.5 bg-brand-accent/15 text-brand-accent">
                  {r.category}
                </span>
                <span>{r.pages} pages</span>
              </div>
              <h3 className="text-lg font-extrabold uppercase tracking-tight leading-tight">
                {r.title}
              </h3>
              <p className="text-sm text-white/70 mt-3 leading-relaxed flex-1">
                {r.abstract}
              </p>
              <a
                href={`mailto:advisory@thegentrylab.com?subject=Research%20access%20-%20${encodeURIComponent(r.title)}`}
                className="mt-6 inline-block w-fit px-5 py-3 border border-brand-accent text-brand-accent font-mono text-[10px] uppercase tracking-widest hover:bg-brand-accent hover:text-black transition"
              >
                Request access →
              </a>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
