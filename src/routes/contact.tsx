import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — The Gentry Lab" },
      {
        name: "description",
        content:
          "Engage The Gentry Lab for Cambodia industrial development advisory. Land selection, technical due diligence, EPC oversight.",
      },
      { property: "og:title", content: "Contact The Gentry Lab" },
      { property: "og:description", content: "Direct advisory for manufacturers entering Cambodia." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      <TopNav />
      <main className="flex-1 px-6 py-16 md:py-24 max-w-5xl mx-auto w-full">
        <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
          Engage
        </p>
        <h1 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tighter leading-[0.95] mt-4">
          Secure your
          <br />
          industrial <span className="text-brand-accent">footprint.</span>
        </h1>
        <p className="text-white/70 max-w-2xl mt-6 text-lg leading-relaxed">
          Direct advisory for manufacturers and funds entering Cambodia.
          Typical engagements: feasibility study, technical due diligence,
          owner's representative for EPC delivery.
        </p>

        <div className="mt-10 grid md:grid-cols-2 gap-px bg-white/10 border border-white/10">
          <div className="bg-black p-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">
              Phnom Penh Office
            </p>
            <p className="text-white leading-relaxed">
              Exchange Square, Tower B<br />
              Level 14, Wat Phnom<br />
              Phnom Penh, Cambodia
            </p>
          </div>
          <div className="bg-black p-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">
              Contact
            </p>
            <p className="text-white leading-relaxed">
              <a href="mailto:advisory@thegentrylab.com" className="hover:text-brand-accent">
                advisory@thegentrylab.com
              </a>
              <br />
              +855 (0) 23 900 123
            </p>
          </div>
        </div>

        <a
          href="mailto:advisory@thegentrylab.com?subject=Feasibility%20Study%20Request"
          className="inline-block mt-10 px-8 py-5 bg-brand-accent text-black font-mono text-xs uppercase tracking-widest hover:brightness-110 transition"
        >
          Email principal advisor
        </a>
      </main>
      <Footer />
    </div>
  );
}
