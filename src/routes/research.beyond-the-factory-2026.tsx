import { createFileRoute, Link } from "@tanstack/react-router";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { useSmoothScroll, useReveal } from "@/components/site/Counter";

export const Route = createFileRoute("/research/beyond-the-factory-2026")({
  head: () => ({
    meta: [
      { title: "Beyond the Factory — Industrial Insight 01 | The Gentry Lab" },
      {
        name: "description",
        content: "What the next generation of manufacturing means for Cambodia — a practical perspective from Sihanoukville & ISI SEZ, using Roadboss Tire Cambodia as a case reference.",
      },
      { property: "og:title", content: "Beyond the Factory — The Gentry Lab" },
      { property: "og:description", content: "Cambodia doesn't only need more factories. It needs to become increasingly capable of supporting better ones." },
    ],
  }),
  component: BeyondTheFactory,
});

const TAGS = [
  "TheGentryLab", "Cambodia", "IndustrialDevelopment", "Manufacturing", "Sihanoukville",
  "ISI", "ISISEZ", "ISIEC", "Roadboss", "SEZ", "IndustrialPark", "InvestInCambodia",
  "CambodiaManufacturing", "SupplyChain", "Infrastructure", "SmartManufacturing",
  "GreenIndustry", "FutureOfManufacturing",
];

/* ── Placeholder for photos the author will add shortly ──── */
function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-white/15 bg-white/[0.02] flex items-center justify-center py-10 my-2 print:hidden">
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">{label} — photo to be added</p>
    </div>
  );
}

/* ── Small reusable "category card" for the two question/list grids ── */
function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-white/8 bg-white/[0.02] p-4 print:border-black/20">
      <p className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: "#ff5100" }}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className="text-[13px] text-white/60 leading-relaxed print:text-black/75">{it}</li>
        ))}
      </ul>
    </div>
  );
}

function BeyondTheFactory() {
  useSmoothScroll();
  useReveal();

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
              Industrial Insight 01 | 2026
            </span>
            <span className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest border border-emerald-400/40 text-emerald-400 bg-emerald-400/10">
              Free Preview
            </span>
          </div>

          <h1 className="text-3xl md:text-6xl font-extrabold uppercase tracking-tighter leading-[0.95] mb-4 print:text-black">
            Beyond the Factory
          </h1>
          <p className="text-white/70 text-lg md:text-xl leading-snug max-w-2xl mb-3 print:text-black/80">
            What the Next Generation of Manufacturing Means for Cambodia
          </p>
          <p className="text-white/40 max-w-2xl print:text-black/60">
            A Practical Perspective from Sihanoukville &amp; ISI SEZ
          </p>

          <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mt-7">
            People · Places · Possibilities
          </p>
        </div>
      </section>

      <PhotoPlaceholder label="Hero — aerial view of ISI SEZ" />

      {/* ── Body ── */}
      <article className="max-w-4xl mx-auto px-6 md:px-12 py-14 space-y-14 print:py-6 print:space-y-8">

        {/* 01 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">01 · From the Ground</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            Manufacturing is changing. Are we ready for what comes with it?
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>
              Over the past decade, I have had the opportunity to work practically across industrial projects in
              Cambodia — from factory planning, engineering and construction to infrastructure, cost, utilities
              and project delivery.
            </p>
            <p>Looking at the scale of industrial development happening today, I believe we are entering another important stage.</p>
            <p>The story is no longer simply about bringing more factories into Cambodia.</p>
            <p>The question is becoming:</p>
            <p className="text-white font-semibold print:text-black">
              What kind of manufacturing do we want to attract, and what must Cambodia be ready for when it arrives?
            </p>
            <p>This became particularly clear to me while looking at the development taking shape at ISI SEZ in Sihanoukville.</p>
            <p>From the air, we see large factory buildings, internal roads, infrastructure and land being transformed.</p>
            <p>But what interests me is not only what has already been constructed. It is what can grow around it.</p>
            <p>A major manufacturing investment does not exist by itself. It requires power. It consumes and manages water. It needs roads, ports and logistics. It creates demand for workers and technical skills. It brings suppliers, maintenance services, engineering, construction, transportation and supporting businesses.</p>
            <p>And when enough of these activities begin to connect with each other, we are no longer talking about individual factories. We are talking about an <strong className="text-white print:text-black">industrial ecosystem</strong>.</p>
            <p>That is the opportunity I believe Cambodia should be preparing for.</p>
          </div>
        </section>

        {/* 02 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">02 · A New Scale of Manufacturing</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            Roadboss Tire Cambodia — More Than a Factory
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>Roadboss Tire's planned Cambodia operation provides an interesting example of the scale of manufacturing investment now emerging in the country.</p>
            <p>According to the company's January 2026 introduction, its Cambodia operation is located within ISI SEZ in Sihanoukville Province and covers more than 2,000 mu of land.</p>
            <p>The company indicates planned annual production capacity of:</p>
          </div>
          <div className="grid grid-cols-2 gap-4 my-6">
            {[
              { n: "15M", label: "PCR tires / year" },
              { n: "2.6M", label: "TBR tires / year" },
            ].map((s) => (
              <div key={s.label} className="border border-white/8 px-5 py-4 print:border-black/15">
                <p className="text-3xl font-extrabold tracking-tighter text-[#ff5100] print:text-black">{s.n}</p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mt-1 print:text-black/50">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>
              The operation is expected to employ more than <strong className="text-white print:text-black">2,000 people</strong>,
              while its products are positioned for international markets spanning more than{" "}
              <strong className="text-white print:text-black">170 countries and regions</strong>.
            </p>
            <p>This is significant not simply because of the size of the factory. It is significant because of the type of manufacturing system being introduced.</p>
            <p>The company describes a manufacturing platform incorporating industrial internet, big data, 5G, IoT, artificial intelligence, automated logistics and digital production-management systems.</p>
            <p>Its equipment strategy combines international and Chinese manufacturing technology, including automated production equipment, AGVs, automated warehousing and quality-control systems.</p>
            <p>This represents a different level of industrial requirement.</p>
            <p>A factory of this nature cannot depend only on four walls and a roof. It depends on the ecosystem surrounding it.</p>
          </div>
        </section>

        <PhotoPlaceholder label="Roadboss Tire Cambodia site" />

        {/* 03 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">03 · Why Sihanoukville Matters</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            From Port City to Industrial Gateway
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>Sihanoukville has a strategic advantage that very few locations in Cambodia can replicate.</p>
            <p className="text-white font-semibold text-lg print:text-black">The port.</p>
            <p>For export-oriented manufacturing, logistics is one of the most important components of competitiveness.</p>
            <p>Raw materials need to arrive. Equipment needs to be imported. Finished products need to reach international markets.</p>
            <p>Every additional movement, delay or logistics constraint eventually becomes part of the manufacturer's cost.</p>
            <p>This makes the relationship between industrial development and port infrastructure particularly important.</p>
            <p>For Sihanoukville, the opportunity is therefore bigger than simply developing more industrial land.</p>
            <p>The long-term opportunity is to create a connected manufacturing and logistics ecosystem around:</p>
          </div>
          <p className="mt-5 text-center font-mono text-[11px] md:text-[13px] uppercase tracking-widest text-white/80 border border-white/10 bg-white/[0.02] px-4 py-4 print:border-black/20 print:text-black">
            Port → Expressway → Industrial Zones → Utilities → Manufacturing → Suppliers → Global Markets
          </p>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] mt-5 print:text-black/80">
            <p>When these elements work together, location becomes a competitive advantage.</p>
            <p>But infrastructure alone does not automatically create an industrial cluster. The surrounding development environment must be ready as well.</p>
          </div>
        </section>

        {/* 04 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">04 · Beyond the Factory</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            One Factory Can Create Many Other Opportunities
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>When we look at a large manufacturing investment, it is easy to focus on the investment value or number of jobs.</p>
            <p>But the economic impact can extend much further.</p>
            <p>Consider a tire factory.</p>
            <p>The factory itself requires raw materials, machinery, energy, water, logistics and labor.</p>
            <p>Around that factory, another layer of businesses can develop.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
            <InfoCard title="Raw Materials" items={["Rubber", "Steel reinforcement", "Carbon black", "Chemicals", "Packaging materials"]} />
            <InfoCard title="Industrial Services" items={["Engineering", "Equipment maintenance", "Automation", "Testing and inspection", "Environmental services"]} />
            <InfoCard title="Logistics" items={["Trucking", "Warehousing", "Container handling", "Freight forwarding", "Customs services"]} />
            <InfoCard title="Construction & Infrastructure" items={["Factory expansion", "Warehouses", "Utility systems", "Roads and drainage", "Worker facilities"]} />
            <InfoCard title="People" items={["Engineers", "Technicians", "Machine operators", "Logistics specialists", "Maintenance teams", "Management professionals"]} />
          </div>

          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>This is where the real long-term value of industrial development starts to appear.</p>
          </div>
          <p className="mt-5 text-center font-mono text-[10px] md:text-[12px] uppercase tracking-widest text-white/80 border border-white/10 bg-white/[0.02] px-4 py-4 print:border-black/20 print:text-black">
            Factory → Suppliers → Services → Skills → Infrastructure → Industrial Cluster
          </p>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] mt-5 print:text-black/80">
            <p>The objective should therefore not only be attracting the anchor manufacturer. Cambodia should think about how to capture more of the value created around that manufacturer.</p>
          </div>
        </section>

        {/* 05 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">05 · From Assembly to Industrial Capability</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            The Bigger Opportunity for Cambodia
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>For many years, Cambodia's manufacturing story has been strongly associated with labor-intensive production.</p>
            <p>That has played an important role in Cambodia's development. But the next stage can go further.</p>
            <p>Modern manufacturing investment can introduce:</p>
          </div>
          <div className="flex flex-wrap gap-2 my-5">
            {["Automation", "Digital manufacturing", "Advanced production equipment", "International quality systems", "Technical skills", "Supply-chain management", "Environmental standards", "Engineering capability"].map((t) => (
              <span key={t} className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border border-white/10 bg-white/[0.03] text-white/70 print:border-black/20 print:text-black">{t}</span>
            ))}
          </div>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>Roadboss describes its Cambodia facility as incorporating digital production management, intelligent logistics, AI-supported quality inspection and automated manufacturing systems.</p>
            <p>This matters. Because technology does not only enter Cambodia through machines. Knowledge comes with it.</p>
            <p>Workers learn. Engineers gain experience. Local suppliers improve. Service companies develop new capabilities.</p>
            <p>Over time, these capabilities can transfer into other industries.</p>
            <p>This is how industrial development can gradually move from:</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-5 text-center">
            <span className="font-mono text-[12px] uppercase tracking-widest text-white/50 border border-white/10 px-4 py-2 print:text-black/60 print:border-black/20">Made in Cambodia</span>
            <span className="text-white/30">→</span>
            <span className="font-mono text-[12px] uppercase tracking-widest px-4 py-2 border" style={{ color: "#ff5100", borderColor: "rgba(255,81,0,0.4)", backgroundColor: "rgba(255,81,0,0.08)" }}>Industrial Capability in Cambodia</span>
          </div>
          <p className="text-white/60 leading-relaxed text-[15px] mt-5 print:text-black/80">That distinction will become increasingly important over the next decade.</p>
        </section>

        {/* 06 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">06 · What Cambodia Should Be Ready For</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            Attracting Investment Is Only the Beginning
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>From my practical experience working on industrial developments, one lesson continues to become clearer:</p>
            <p className="text-white font-semibold print:text-black">Getting the investor interested is only the first step.</p>
            <p>The real test begins when the project needs to be implemented.</p>
            <p>A manufacturer may ask: <strong className="text-white print:text-black">Can I buy this land?</strong></p>
            <p>But the development team needs to ask many more questions.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <InfoCard title="Power" items={["How much capacity does the factory require?", "Is that capacity available today?", "If not, how long will an upgrade take?", "What redundancy is required?", "How will future expansion be supported?"]} />
            <InfoCard title="Water" items={["What is the daily industrial demand?", "Where will the water come from?", "Is storage required?", "What happens during peak demand?"]} />
            <InfoCard title="Wastewater" items={["What type of effluent will the production process generate?", "Can the industrial park treatment system handle it?", "Is pretreatment required?", "What environmental standards need to be achieved?"]} />
            <InfoCard title="Logistics" items={["How far is the port?", "Can the roads handle the required truck movements?", "Is container movement efficient?", "Where will trucks wait?", "How will raw materials and finished goods flow through the site?"]} />
            <InfoCard title="People" items={["Where will thousands of workers come from?", "How will they travel to work?", "Where will they live?", "Are the technical skills available locally?", "What training will be required?"]} />
            <InfoCard title="Land" items={["Is the land legally ready?", "Is the elevation appropriate?", "What is the flood risk?", "What soil conditions should be expected?", "Is there sufficient land for future expansion?"]} />
          </div>

          <div className="mt-4">
            <InfoCard title="Development Process" items={["How quickly can approvals move?", "Are environmental, construction, fire and operational requirements understood early?", "Can design, permits, procurement and construction move together without creating unnecessary project risk?"]} />
          </div>

          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] mt-6 print:text-black/80">
            <p>These questions are not secondary issues. For industrial investors, they directly affect:</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {["CAPEX.", "Schedule.", "Operational risk."].map((t) => (
              <span key={t} className="font-mono text-[11px] uppercase tracking-widest text-white/70 print:text-black/70">{t}</span>
            ))}
          </div>
          <p className="text-white/60 leading-relaxed text-[15px] mt-3 print:text-black/80">
            And ultimately: <strong className="text-white print:text-black">Investment confidence.</strong>
          </p>
        </section>

        {/* 07 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">07 · The Local Supply Chain Opportunity</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            How Much Value Can Stay in Cambodia?
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>This may be one of the most important questions.</p>
            <p>When a large manufacturer enters Cambodia, how much of its economic activity can eventually be supported locally?</p>
            <p>Roadboss identifies local natural rubber as one area where its Cambodian operation can contribute to greater integration between agriculture and industry.</p>
            <p>That is an important example.</p>
            <p>Cambodia already produces raw materials. But greater value can be created when those materials connect with manufacturing, processing, engineering and export industries inside the country.</p>
            <p>The same thinking applies beyond rubber. Future industrial policy and private-sector development should increasingly ask:</p>
          </div>
          <ul className="space-y-2 mt-4">
            {[
              "What can Cambodia supply locally?",
              "What are we currently importing that could eventually be produced here?",
              "What supporting industries could locate close to major manufacturers?",
              "What capabilities do Cambodian companies need to meet international supplier standards?",
            ].map((q) => (
              <li key={q} className="flex items-start gap-2.5 text-[15px] text-white/70 print:text-black/80">
                <span className="mt-2 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: "#ff5100" }} />
                {q}
              </li>
            ))}
          </ul>
          <p className="text-white/60 leading-relaxed text-[15px] mt-5 print:text-black/80">
            An anchor factory can therefore become more than a tenant. It can become the beginning of an industrial cluster.
          </p>
        </section>

        {/* 08 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">08 · People May Become the Most Important Infrastructure</p>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>Industrial development is usually discussed in terms of land, roads and electricity.</p>
            <p>But as manufacturing becomes more sophisticated, another type of infrastructure becomes increasingly important:</p>
            <p className="text-white font-semibold text-lg print:text-black">Human capability.</p>
            <p>Modern factories require more than general labor. They require:</p>
          </div>
          <div className="flex flex-wrap gap-2 my-5">
            {["Technicians", "Automation specialists", "Electrical engineers", "Mechanical engineers", "Production engineers", "Quality specialists", "Maintenance teams", "Environmental professionals", "Supply-chain specialists", "Digital-system operators", "Managers"].map((t) => (
              <span key={t} className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border border-white/10 bg-white/[0.03] text-white/70 print:border-black/20 print:text-black">{t}</span>
            ))}
          </div>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>Roadboss indicates that its operation is expected to create thousands of local employment opportunities and includes cooperation around workforce skills development.</p>
            <p>For Cambodia, this should be viewed as a long-term opportunity.</p>
            <p>The question is not only: <strong className="text-white print:text-black">How many jobs will the factory create?</strong></p>
            <p>The better question is: <strong className="text-white print:text-black">What new skills will Cambodia gain because the factory is here?</strong></p>
            <p>Industrial parks, manufacturers, universities, technical institutes and government agencies have an opportunity to work much more closely around this issue.</p>
            <p>The industrial workforce we prepare today will influence the industries Cambodia can attract tomorrow.</p>
          </div>
        </section>

        {/* 09 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">09 · Green Industrial Development</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            Growth and Sustainability Need to Move Together
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>Industrial growth creates economic value. But it also creates significant demands on energy, water, land and the environment.</p>
            <p>These issues become more important as industrial developments increase in scale.</p>
            <p>Roadboss identifies green manufacturing, resource efficiency, responsible sourcing and wastewater management as part of its development approach.</p>
            <p>At the industrial-park level, this creates another important discussion.</p>
            <p>Future industrial competitiveness will increasingly depend on more than land price and labor cost. Investors will also consider:</p>
          </div>
          <div className="flex flex-wrap gap-2 my-5">
            {["Energy efficiency", "Renewable energy", "Water security", "Wastewater treatment", "Waste management", "Carbon performance", "Supply-chain sustainability", "Environmental compliance"].map((t) => (
              <span key={t} className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300/80 print:border-black/20 print:text-black">{t}</span>
            ))}
          </div>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>Industrial parks therefore have an opportunity to evolve from simply providing serviced land toward providing a more complete <strong className="text-white print:text-black">sustainable industrial platform</strong>.</p>
            <p>This can include shared infrastructure and services that individual factories would otherwise need to develop independently.</p>
            <p>Done well, sustainability becomes more than compliance. It becomes part of industrial competitiveness.</p>
          </div>
        </section>

        {/* 10 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">10 · Industrial Development Needs Partnership</p>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>During this development journey, I have also had the opportunity to engage with provincial leadership in Sihanoukville.</p>
            <p>For me, these interactions reinforce an important point.</p>
            <p className="text-white font-semibold print:text-black">No single organization can build an industrial ecosystem alone.</p>
            <p>Government creates the enabling environment. Developers prepare land and infrastructure. Manufacturers bring investment, technology and global markets. Financial institutions provide capital. Educational institutions develop people. Local companies build supporting industries. Engineers and contractors turn plans into physical assets. Logistics providers connect production to markets.</p>
            <p>When these pieces work separately, development becomes difficult. When they work together, industrial growth can accelerate.</p>
            <p>This is why collaboration between:</p>
          </div>
          <p className="mt-5 text-center font-mono text-[10px] md:text-[12px] uppercase tracking-widest text-white/80 border border-white/10 bg-white/[0.02] px-4 py-4 print:border-black/20 print:text-black">
            Government + Developers + Investors + Industry + Education + Infrastructure Providers
          </p>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] mt-5 print:text-black/80">
            <p>will become increasingly important.</p>
            <p>The objective should not simply be approving more factories. The objective should be creating an environment where good manufacturers can enter Cambodia, establish successfully, expand confidently and remain competitive for decades.</p>
          </div>
        </section>

        {/* 11 */}
        <section className="reveal">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">11 · From Factory to Cluster</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            What Could Come Next?
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>Looking at today's factory development, I often think about what the same location could look like ten years from now.</p>
            <p>An anchor manufacturer arrives. Then logistics providers expand. Suppliers begin locating nearby. Workers and technical talent concentrate around the area. Training institutions respond to industry demand. Supporting factories appear. Warehouses and distribution facilities grow. Utilities expand. Infrastructure improves.</p>
            <p>Eventually, what started as one investment becomes a cluster.</p>
            <p>This is how we should think about the future value of major industrial investments.</p>
            <p>Not: <strong className="text-white print:text-black">How much factory area are we building today?</strong></p>
            <p>But: <strong className="text-white print:text-black">What industrial ecosystem could grow around this investment tomorrow?</strong></p>
            <p>For Sihanoukville, the combination of port access, logistics infrastructure, industrial land and increasing manufacturing activity creates an interesting foundation.</p>
            <p>The opportunity is significant. But realizing it will require deliberate planning.</p>
          </div>
        </section>

        {/* 12 */}
        <section className="reveal border-t border-white/10 pt-10">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2 print:text-black/40">12 · The Gentry Lab View</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight mb-4 print:text-black">
            Cambodia's Next Industrial Question
          </h2>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>Cambodia does not only need more factories.</p>
            <p className="text-white font-semibold print:text-black">Cambodia needs to become increasingly capable of supporting better factories.</p>
            <p>Factories with more technology. Factories connected to global supply chains. Factories creating stronger local supplier networks. Factories developing technical skills. Factories operating with higher environmental standards. Factories that remain and expand for the long term.</p>
            <p>This changes how we should think about industrial development.</p>
            <p>Land availability alone is not enough. Low labor cost alone is not enough. Investment incentives alone are not enough.</p>
            <p>The next generation of industrial competitiveness will increasingly depend on the <strong className="text-white print:text-black">complete development ecosystem</strong>. That means:</p>
          </div>
          <div className="flex flex-wrap gap-2 my-5">
            {["Infrastructure readiness", "Reliable utilities", "Efficient logistics", "Development certainty", "Skilled people", "Local supply chains", "Environmental capability", "Expansion potential"].map((t) => (
              <span key={t} className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border border-white/10 bg-white/[0.03] text-white/70 print:border-black/20 print:text-black">{t}</span>
            ))}
          </div>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p>and, importantly, <strong className="text-white print:text-black">the ability to execute.</strong></p>
            <p>From what I have witnessed working practically across industrial development and project delivery, the opportunity for Cambodia is real.</p>
            <p>But the value will not come automatically. We need to prepare for it.</p>
            <p>The factories being built today could become the foundation of much larger industrial ecosystems tomorrow.</p>
            <p>The question for Cambodia is:</p>
          </div>
          <h3 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tighter leading-tight mt-6 print:text-black">
            Are we preparing only for the next factory —<br />
            <span style={{ color: "#ff5100" }}>or for the next generation of Cambodian industry?</span>
          </h3>
        </section>

        {/* ── About ── */}
        <section className="reveal border-t border-white/10 pt-10">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-3">About The Gentry Lab</p>
          <div className="space-y-4 text-white/60 leading-relaxed text-[15px] print:text-black/80">
            <p><strong className="text-white print:text-black">The Gentry Lab</strong> explores the intersection between industrial investment, development strategy and practical project execution in Cambodia.</p>
            <p>Our work looks beyond individual buildings to understand the complete industrial development journey:</p>
          </div>
          <p className="mt-4 text-center font-mono text-[10px] md:text-[12px] uppercase tracking-widest text-white/70 border border-white/10 bg-white/[0.02] px-4 py-4 print:border-black/20 print:text-black">
            Land → Infrastructure → Utilities → Permits → Factory → Operation → Expansion
          </p>
          <p className="text-white/60 leading-relaxed text-[15px] mt-4 print:text-black/80">
            Through research, practical frameworks, case studies and industry perspectives, The Gentry Lab aims to bridge the gap between investment ambition and development reality.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mt-6">People | Places | Possibilities</p>
          <p className="text-white/50 text-[13px] mt-1">The Gentry Lab — Cambodia Industrial Development Intelligence &amp; Advisory</p>
        </section>

        {/* ── Case reference ── */}
        <section className="reveal border-t border-white/10 pt-10">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-3">Case Reference</p>
          <div className="space-y-4 text-white/50 leading-relaxed text-[13px] print:text-black/70">
            <p>This Industrial Insight uses Roadboss Tire (Cambodia) as a case perspective based on company information provided in its January 2026 corporate introduction.</p>
            <p>The company describes its Cambodia operation as being located at ISI SEZ in Sihanoukville Province, with more than 2,000 mu of land, more than 2,000 employees, planned annual production capacity of 15 million PCR and 2.6 million TBR tires, international market coverage and an increasingly digital and automated manufacturing platform.</p>
            <p>The company materials also identify green manufacturing, wastewater management, local natural-rubber supply-chain development, employment and skills development as components of its Cambodia strategy.</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">Source: Roadboss Tire (Cambodia) Company Introduction, January 2026.</p>
          </div>
        </section>

        {/* ── Tags ── */}
        <section className="reveal flex flex-wrap gap-2 print:hidden">
          {TAGS.map((t) => (
            <span key={t} className="font-mono text-[9px] text-white/25">#{t}</span>
          ))}
        </section>

        {/* ── CTA ── */}
        <section className="reveal border-t border-white/10 pt-10 print:hidden">
          <div className="border border-white/10 bg-[#0d0d0e] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-1.5">Industrial Insight 01 | 2026</p>
              <p className="text-white font-bold text-lg leading-tight">
                Explore the full Research Library — site intelligence, cost benchmarks and permit pathways.
              </p>
            </div>
            <Link
              to="/research"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 font-mono text-[10px] uppercase tracking-widest bg-[#ff5100] text-black hover:brightness-110 transition"
            >
              Browse Research Library
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5h8M5.5 1.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        </section>
      </article>

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
