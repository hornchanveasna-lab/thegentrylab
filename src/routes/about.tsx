import { createFileRoute, Link } from "@tanstack/react-router";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import principalPortrait from "@/assets/principal-portrait.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — The Gentry Lab" },
      {
        name: "description",
        content:
          "The Gentry Lab is Cambodia's industrial development advisor — bridging foreign capital and local execution across land, permits, utilities and EPC.",
      },
      { property: "og:title", content: "About The Gentry Lab" },
      { property: "og:description", content: "Cambodia industrial development advisor." },
    ],
  }),
  component: AboutPage,
});

const services = [
  { n: "01", title: "Land Selection", body: "Topographic surveys, SEZ feasibility, utility capacity verification, and flood-risk mitigation for industrial sites." },
  { n: "02", title: "Technical DD", body: "Rigorous due diligence ahead of acquisition. Structural, environmental, permitting strategy and cost benchmarking." },
  { n: "03", title: "Project Delivery", body: "Full masterplanning and owner's representative services. We manage the contractor so foreign principals don't have to." },
];

const clients = [
  { t: "Foreign Industrial Investors", d: "Manufacturers from China, Singapore, Thailand, Malaysia, Japan, Korea and Europe entering Cambodia." },
  { t: "Landowners", d: "Families and Oknha-owned holdings of 20–500 ha seeking highest and best industrial use." },
  { t: "SEZ & Park Developers", d: "New industrial parks, private SEZ operators and logistics-park developers." },
  { t: "Banks & Funds", d: "Independent technical due diligence and construction-risk assessment for project finance." },
];

function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      <TopNav />
      <main className="flex-1">
        <section className="px-6 py-16 md:py-24 max-w-5xl mx-auto">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
            About · The Gentry Lab
          </p>
          <h1 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tighter leading-[0.95] mt-4">
            Cambodia Industrial
            <br />
            Development <span className="text-brand-accent">Advisor.</span>
          </h1>
          <p className="text-white/70 max-w-2xl mt-6 text-lg leading-relaxed">
            Not a consultant. Not an architect. Not a contractor. The Gentry Lab
            is a development advisor and execution bridge — helping foreign
            investors move from land acquisition to factory operation.
          </p>
          <Link
            to="/contact"
            className="inline-block mt-8 px-7 py-4 bg-brand-accent text-black font-mono text-xs uppercase tracking-widest hover:brightness-110 transition"
          >
            Request a feasibility call
          </Link>
        </section>

        <section className="border-t border-white/10 px-6 py-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-extrabold uppercase tracking-tighter mb-10">
            Core advisory
          </h2>
          <div className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10">
            {services.map((s) => (
              <div key={s.n} className="bg-black p-8">
                <span className="text-brand-accent font-mono text-sm">{s.n}</span>
                <h3 className="text-lg font-extrabold uppercase mt-4 mb-3">{s.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-extrabold uppercase tracking-tighter mb-10">
            Who we advise
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10">
            {clients.map((c) => (
              <div key={c.t} className="bg-black p-6">
                <h3 className="text-sm font-extrabold uppercase mb-2 tracking-tight">
                  {c.t}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 grid lg:grid-cols-2">
          <div className="px-6 py-16 lg:p-20 flex flex-col justify-center order-2 lg:order-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
              Principal
            </p>
            <h2 className="text-3xl font-extrabold uppercase tracking-tighter mt-2 mb-8">
              Technical leadership
            </h2>
            <p className="text-lg leading-relaxed text-white/80">
              "Success in Cambodia's industrial sector requires more than capital.
              It requires a working command of local land, permits, utilities and
              international construction standards — under one roof."
            </p>
            <div className="pt-10">
              <p className="font-extrabold uppercase">Principal Advisor</p>
              <p className="font-mono text-xs text-white/50 uppercase tracking-widest mt-1">
                Registered Architect + Engineer · EPC Lead
              </p>
              <p className="text-sm text-white/60 mt-4 max-w-md">
                Over a decade of industrial project delivery across ASEAN —
                airport infrastructure, EPC tendering, and masterplanning of
                manufacturing campuses.
              </p>
            </div>
          </div>
          <div className="bg-stone-900 order-1 lg:order-2">
            <img
              src={principalPortrait}
              alt="Principal advisor portrait"
              loading="lazy"
              className="w-full h-full object-cover aspect-[4/5] lg:aspect-auto"
            />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
