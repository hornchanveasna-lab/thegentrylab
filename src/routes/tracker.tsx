import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { PROJECTS, SECTORS, type Sector, type TrackedProject } from "@/data/platform";

export const Route = createFileRoute("/tracker")({
  head: () => ({
    meta: [
      { title: "Industrial Project Tracker — The Gentry Lab" },
      {
        name: "description",
        content:
          "Live tracker of factory, warehouse and data-center projects across Cambodia. Filter by sector, province and status.",
      },
      { property: "og:title", content: "Cambodia Industrial Project Tracker" },
      { property: "og:description", content: "Track manufacturing investments across Cambodia." },
    ],
  }),
  component: TrackerPage,
});

const STATUSES = ["Planned", "Under Construction", "Operational"] as const;

function TrackerPage() {
  const provinces = useMemo(
    () => Array.from(new Set(PROJECTS.map((p) => p.province))).sort(),
    [],
  );
  const [sector, setSector] = useState<Sector | "All">("All");
  const [province, setProvince] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");
  const [selected, setSelected] = useState<TrackedProject | null>(null);

  const filtered = useMemo(
    () =>
      PROJECTS.filter(
        (p) =>
          (sector === "All" || p.sector === sector) &&
          (province === "All" || p.province === province) &&
          (status === "All" || p.status === status),
      ).sort((a, b) => b.updated.localeCompare(a.updated)),
    [sector, province, status],
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      <TopNav />
      <main className="flex-1 px-6 py-10 max-w-7xl mx-auto w-full">
        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
            Industrial Project Tracker
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tighter mt-2">
            What's being built in Cambodia
          </h1>
          <p className="text-white/60 max-w-2xl mt-3 text-sm leading-relaxed">
            A curated registry of active and planned industrial projects.
            Updated continuously from CDC approvals, ground intelligence and
            developer announcements.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 mb-6 font-mono text-[11px] uppercase tracking-widest">
          <Select label="Sector" value={sector} onChange={(v) => setSector(v as Sector | "All")} options={["All", ...SECTORS]} />
          <Select label="Province" value={province} onChange={setProvince} options={["All", ...provinces]} />
          <Select label="Status" value={status} onChange={setStatus} options={["All", ...STATUSES]} />
          <div className="ml-auto self-center text-white/40">
            {filtered.length} projects
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="border border-white/10 divide-y divide-white/10">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full grid grid-cols-12 gap-3 px-4 py-4 text-left hover:bg-white/5 transition ${selected?.id === p.id ? "bg-white/5" : ""}`}
              >
                <div className="col-span-12 md:col-span-5">
                  <p className="font-bold text-sm">{p.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">
                    {p.investor} · {p.origin}
                  </p>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest bg-brand-accent/15 text-brand-accent">
                    {p.sector}
                  </span>
                </div>
                <div className="col-span-4 md:col-span-2 font-mono text-[11px] text-white/70">
                  {p.province}
                </div>
                <div className="col-span-4 md:col-span-2 font-mono text-[11px] text-white/70">
                  {p.size}
                </div>
                <div className="col-span-12 md:col-span-1 font-mono text-[10px] uppercase tracking-widest text-white/40 md:text-right">
                  <StatusDot s={p.status} />
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-10 text-center text-white/40 text-sm">
                No projects match the current filters.
              </div>
            )}
          </div>

          <aside className="border border-white/10 h-fit sticky top-20">
            {selected ? (
              <div>
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
                    {selected.sector}
                  </p>
                  <h3 className="font-extrabold text-lg uppercase tracking-tight mt-1 leading-tight">
                    {selected.name}
                  </h3>
                </div>
                <dl className="px-4 py-3 grid grid-cols-3 gap-y-3 text-[11px]">
                  <Row k="Investor" v={selected.investor} />
                  <Row k="Origin" v={selected.origin} />
                  <Row k="Province" v={selected.province} />
                  <Row k="Size" v={selected.size} />
                  <Row k="Status" v={selected.status} />
                  <Row k="Updated" v={selected.updated} />
                </dl>
                <p className="px-4 py-3 border-t border-white/10 text-xs text-white/70 leading-relaxed">
                  {selected.summary}
                </p>
                <div className="px-4 py-3 border-t border-white/10 font-mono text-[9px] uppercase tracking-widest text-white/30">
                  Illustrative · Confirm with primary sources
                </div>
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-white/40 text-sm">
                Select a project to view details.
              </div>
            )}
          </aside>
        </div>
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
  options: readonly string[];
}) {
  return (
    <label className="flex items-center gap-2 border border-white/10 px-3 py-2 bg-white/0 hover:bg-white/5 transition">
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

function StatusDot({ s }: { s: TrackedProject["status"] }) {
  const color =
    s === "Operational" ? "#22c55e" : s === "Under Construction" ? "#ff5100" : "#facc15";
  return (
    <span className="inline-flex items-center gap-2 justify-end">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {s}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-white/40">
        {k}
      </dt>
      <dd className="col-span-2 text-white">{v}</dd>
    </>
  );
}
