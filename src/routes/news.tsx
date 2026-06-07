import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { NEWS } from "@/data/platform";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Industrial News — The Gentry Lab" },
      {
        name: "description",
        content:
          "Curated industrial news from Cambodia: SEZs, factory openings, infrastructure projects and regulation updates.",
      },
      { property: "og:title", content: "Cambodia Industrial News" },
      { property: "og:description", content: "What matters this week in Cambodia industrial development." },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const sectors = useMemo(
    () => Array.from(new Set(NEWS.map((n) => n.sector))).sort(),
    [],
  );
  const provinces = useMemo(
    () => Array.from(new Set(NEWS.map((n) => n.province))).sort(),
    [],
  );
  const [sector, setSector] = useState<string>("All");
  const [province, setProvince] = useState<string>("All");

  const filtered = NEWS.filter(
    (n) =>
      (sector === "All" || n.sector === sector) &&
      (province === "All" || n.province === province),
  ).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      <TopNav />
      <main className="flex-1 px-6 py-10 max-w-5xl mx-auto w-full">
        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
            Industrial News
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tighter mt-2">
            What moved this week
          </h1>
          <p className="text-white/60 max-w-2xl mt-3 text-sm leading-relaxed">
            Filtered news that matters for industrial investment decisions in
            Cambodia. No tourism, no politics. Just deals, infrastructure and
            regulation.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 mb-6 font-mono text-[11px] uppercase tracking-widest">
          <Select label="Sector" value={sector} onChange={setSector} options={["All", ...sectors]} />
          <Select label="Province" value={province} onChange={setProvince} options={["All", ...provinces]} />
        </div>

        <ul className="border border-white/10 divide-y divide-white/10">
          {filtered.map((n) => (
            <li key={n.id} className="p-5 hover:bg-white/5 transition">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">
                <span className="px-2 py-0.5 bg-brand-accent/15 text-brand-accent">
                  {n.sector}
                </span>
                <span>{n.province}</span>
                <span className="ml-auto">{n.date}</span>
              </div>
              <a
                href={n.url}
                className="text-lg font-bold leading-snug hover:text-brand-accent transition"
              >
                {n.headline}
              </a>
              <p className="text-sm text-white/70 mt-2 leading-relaxed">{n.summary}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-3">
                Source · {n.source}
              </p>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-2 border border-white/10 px-3 py-2">
      <span className="text-white/40">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none text-white"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-black">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
