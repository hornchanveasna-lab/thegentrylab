import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { useLang } from "@/lib/i18n";

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

const EMAIL = "advisory@thegentrylab.io";

function ContactPage() {
  const { t } = useLang();

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      <TopNav />
      <main className="flex-1 px-6 py-16 md:py-24 max-w-5xl mx-auto w-full">
        <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
          {t("contact.eyebrow")}
        </p>
        <h1 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tighter leading-[0.95] mt-4">
          {t("contact.headline1")}
          <br />
          {t("contact.headline2")} <span className="text-brand-accent">{t("contact.headlineAccent")}</span>
        </h1>
        <p className="text-white/70 max-w-2xl mt-6 text-lg leading-relaxed">
          {t("contact.body")}
        </p>

        <div className="mt-10 grid md:grid-cols-2 gap-px bg-white/10 border border-white/10">
          <div className="bg-black p-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">
              {t("contact.officeLabel")}
            </p>
            <p className="text-white leading-relaxed">
              Exchange Square, Tower B<br />
              Level 14, Wat Phnom<br />
              Phnom Penh, Cambodia
            </p>
          </div>
          <div className="bg-black p-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">
              {t("contact.contactLabel")}
            </p>
            <p className="text-white leading-relaxed">
              <a href={`mailto:${EMAIL}`} className="hover:text-brand-accent transition-colors">
                {EMAIL}
              </a>
              <br />
              +855 (0) 23 900 123
            </p>
          </div>
        </div>

        <a
          href={`mailto:${EMAIL}?subject=Feasibility%20Study%20Request`}
          className="inline-block mt-10 px-8 py-5 bg-brand-accent text-black font-mono text-xs uppercase tracking-widest hover:brightness-110 transition"
        >
          {t("contact.emailBtn")}
        </a>
      </main>
      <Footer />
    </div>
  );
}
