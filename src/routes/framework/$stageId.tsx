import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import { TopNav } from "@/components/site/TopNav";
import { useSmoothScroll } from "@/components/site/Counter";
import { supabase } from "@/lib/supabase";
import { getStage, getPrev, getNext } from "@/lib/stageContent";
import type { StageContent } from "@/lib/stageContent";

export const Route = createFileRoute("/framework/$stageId")({
  component: StagePage,
  loader: ({ params }) => {
    const stage = getStage(params.stageId);
    if (!stage) throw notFound();
    return stage;
  },
});

const ACCENT = "#ff5100";

/* ─── Small display helpers ───────────────────────────────── */
function Badge({ text, type }: { text: string; type: "insight" | "warning" | "tip" }) {
  const colours = {
    insight: { bg: "rgba(255,81,0,0.12)", border: "rgba(255,81,0,0.3)", dot: ACCENT },
    warning: { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)",  dot: "#ef4444" },
    tip:     { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.3)",  dot: "#22c55e" },
  };
  const c = colours[type];
  const label = { insight: "FIELD INTELLIGENCE", warning: "WARNING", tip: "TIP" }[type];
  return (
    <div className="rounded p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="font-mono text-[9px] uppercase tracking-widest flex items-center gap-1.5 mb-2" style={{ color: c.dot }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.dot }} />
        {label}
      </span>
      <p className="text-sm leading-relaxed text-white/75">{text}</p>
    </div>
  );
}

function RiskPill({ risk }: { risk: "low" | "medium" | "high" }) {
  const map = {
    low:    { label: "LOW RISK",  color: "#22c55e" },
    medium: { label: "MED RISK",  color: "#f59e0b" },
    high:   { label: "HIGH RISK", color: "#ef4444" },
  };
  const { label, color } = map[risk];
  return (
    <span className="font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-sm" style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}>
      {label}
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded px-3 py-2 text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
      <p className="font-bold mb-1" style={{ color: "var(--text-primary)" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}{p.unit ?? ""}
        </p>
      ))}
    </div>
  );
};

/* ─── Document row from Supabase ───────────────────────────── */
type Doc = { id: string; title: string; description: string | null; file_name: string; category: string; created_at: string; file_path: string };

function DocumentCard({ doc }: { doc: Doc }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.storage.from("stage-documents").getPublicUrl(doc.file_path);
    if (data?.publicUrl) setUrl(data.publicUrl);
  }, [doc.file_path]);
  const ext = doc.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3 rounded transition-colors hover:bg-white/5"
      style={{ border: "1px solid var(--border)" }}
    >
      <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-1 rounded-sm shrink-0 mt-0.5" style={{ background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }}>
        {ext}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white/90 truncate">{doc.title}</p>
        {doc.description && <p className="text-xs text-white/45 mt-0.5 line-clamp-2">{doc.description}</p>}
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mt-1">{doc.category}</p>
      </div>
    </a>
  );
}

/* ─── Main page component ─────────────────────────────────── */
function StagePage() {
  useSmoothScroll();
  const stage = Route.useLoaderData() as StageContent;
  const prev  = getPrev(stage.id);
  const next  = getNext(stage.id);
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("stage_documents")
      .select("id,title,description,file_name,category,created_at,file_path")
      .eq("stage_id", stage.id)
      .order("category")
      .then(({ data }) => { if (data) setDocs(data); });
  }, [stage.id]);

  const costTotal = stage.costBreakdown.reduce((s, d) => s + d.value, 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <TopNav />

      {/* ── Breadcrumb ── */}
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-2">
        <nav className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/30">
          <Link to="/" className="hover:text-white/60 transition-colors">Home</Link>
          <span>/</span>
          <span style={{ color: ACCENT }}>GIDF Framework</span>
          <span>/</span>
          <span className="text-white/60">Stage {stage.id}</span>
        </nav>
      </div>

      {/* ── Hero ── */}
      <header className="max-w-6xl mx-auto px-4 pt-6 pb-10 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest mb-3 block" style={{ color: ACCENT }}>
              Stage {stage.id} / 09 — GIDF Framework
            </span>
            <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tight text-white mb-3">
              {stage.title}
            </h1>
            <p className="text-base text-white/50 max-w-2xl leading-relaxed">{stage.subtitle}</p>
          </div>
          <div className="shrink-0 text-right lg:text-right">
            <p className="text-5xl font-black" style={{ color: ACCENT }}>{stage.heroStat.value}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 max-w-[220px] ml-auto mt-1 leading-snug">{stage.heroStat.label}</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-14">

        {/* ── Why It Matters ── */}
        <section>
          <SectionLabel>Why This Stage Matters</SectionLabel>
          <div className="grid lg:grid-cols-3 gap-px" style={{ background: "var(--border)" }}>
            <div className="col-span-2 p-6" style={{ background: "var(--surface-1)" }}>
              <p className="text-sm leading-relaxed text-white/70">{stage.whyItMatters}</p>
            </div>
            <div className="p-6 flex flex-col justify-center" style={{ background: "var(--surface-2)", borderLeft: `3px solid ${ACCENT}` }}>
              <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: ACCENT }}>Key Insight</p>
              <p className="text-sm leading-relaxed text-white/85 font-medium">{stage.keyInsight}</p>
            </div>
          </div>
        </section>

        {/* ── Key Stats Grid ── */}
        <section>
          <SectionLabel>Intelligence Snapshot</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: "var(--border)" }}>
            {stage.keyStats.map((s, i) => (
              <div key={i} className="p-5" style={{ background: s.highlight ? "var(--surface-2)" : "var(--surface-1)" }}>
                {s.highlight && <div className="h-0.5 w-8 mb-3" style={{ background: ACCENT }} />}
                <p className="text-3xl font-black mb-1" style={{ color: s.highlight ? ACCENT : "var(--text-primary)" }}>{s.value}</p>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: ACCENT }}>{s.label}</p>
                <p className="text-[11px] leading-relaxed text-white/40">{s.context}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Process Steps ── */}
        <section>
          <SectionLabel>Process Flow</SectionLabel>
          <div className="relative">
            {stage.processSteps.map((step, i) => (
              <div key={i} className="flex gap-4 mb-px">
                <div className="flex flex-col items-center shrink-0 w-10">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black z-10 relative" style={{ background: ACCENT, color: "white" }}>
                    {step.n}
                  </div>
                  {i < stage.processSteps.length - 1 && (
                    <div className="w-px flex-1 mt-0" style={{ background: `${ACCENT}40`, minHeight: "24px" }} />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="p-5 rounded" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-bold text-white text-sm">{step.title}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[9px] text-white/35">{step.duration}</span>
                        <RiskPill risk={step.risk} />
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-white/55">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Charts: Timeline + Cost ── */}
        <section className="grid lg:grid-cols-2 gap-6">
          <div className="p-6 rounded fw-chart" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: ACCENT }}>Timeline Analysis</p>
            <h3 className="font-bold text-white text-sm mb-5">Estimated vs Actual (weeks)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stage.timelineChart} layout="vertical" barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--text-subtle)" as any, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-muted)" as any, fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(128,128,128,0.06)" }} />
                <Bar dataKey="estimated" fill="rgba(255,81,0,0.4)" name="Estimated" radius={[0, 2, 2, 0]} />
                <Bar dataKey="actual"    fill={ACCENT}              name="Actual"    radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5"><span className="w-3 h-1 rounded" style={{ background: "rgba(255,81,0,0.4)" }} /><span className="text-[10px] text-white/40">Estimated</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-1 rounded" style={{ background: ACCENT }} /><span className="text-[10px] text-white/40">Actual</span></div>
            </div>
          </div>

          <div className="p-6 rounded fw-chart" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: ACCENT }}>Cost Breakdown</p>
            <h3 className="font-bold text-white text-sm mb-4">Budget Allocation</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={stage.costBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {stage.costBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`${Math.round((v / costTotal) * 100)}%`]}
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, color: "var(--foreground)" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {stage.costBreakdown.map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-white/55">{d.name}</span>
                  </div>
                  <span className="font-mono text-[10px]" style={{ color: d.color }}>{Math.round((d.value / costTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Extra chart ── */}
        {stage.extraChart && (
          <section>
            <SectionLabel>{stage.extraChart.title}</SectionLabel>
            <div className="p-6 rounded fw-chart" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <ResponsiveContainer width="100%" height={220}>
                {stage.extraChart.type === "area" ? (
                  <AreaChart data={stage.extraChart.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-muted)" as any, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-muted)" as any, fontSize: 10 }} axisLine={false} tickLine={false} unit={stage.extraChart.unit ? ` ${stage.extraChart.unit}` : ""} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="value" stroke={ACCENT} fill={`${ACCENT}25`} strokeWidth={2} dot={{ fill: ACCENT, r: 3 }} />
                  </AreaChart>
                ) : (
                  <BarChart data={stage.extraChart.data} barCategoryGap="40%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-muted)" as any, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-muted)" as any, fontSize: 10 }} axisLine={false} tickLine={false} unit={stage.extraChart.unit ? ` ${stage.extraChart.unit}` : ""} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Value" radius={[2, 2, 0, 0]}>
                      {stage.extraChart.data.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? ACCENT : `rgba(255,81,0,${Math.max(0.25, 0.85 - i * 0.1)})`} />
                      ))}
                    </Bar>
                    {stage.extraChart.data[0]?.value2 !== undefined && (
                      <Bar dataKey="value2" name="Actual" fill="rgba(255,81,0,0.35)" radius={[2, 2, 0, 0]} />
                    )}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Permit / Cost Matrix ── */}
        {stage.permits.length > 0 && (
          <section>
            <SectionLabel>Permit & Approval Matrix</SectionLabel>
            <div className="overflow-x-auto rounded" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left p-3 font-mono text-[9px] uppercase tracking-widest" style={{ color: ACCENT }}>Permit / Approval</th>
                    <th className="text-left p-3 font-mono text-[9px] uppercase tracking-widest text-white/35">Authority</th>
                    <th className="text-right p-3 font-mono text-[9px] uppercase tracking-widest text-white/35">Cost (USD)</th>
                    <th className="text-right p-3 font-mono text-[9px] uppercase tracking-widest text-white/35">Timeline</th>
                    <th className="text-left p-3 font-mono text-[9px] uppercase tracking-widest text-white/35">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {stage.permits.map((p, i) => (
                    <tr key={i} style={{ background: p.critical ? "var(--surface-2)" : "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {p.critical && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />}
                          <span className="font-semibold text-white/85">{p.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-white/45">{p.authority}</td>
                      <td className="p-3 text-right font-mono whitespace-nowrap">
                        {p.costMin === 0 && p.costMax === 0
                          ? <span className="text-white/30">Gov't fee</span>
                          : <span style={{ color: ACCENT }}>${p.costMin.toLocaleString()}–{p.costMax.toLocaleString()}</span>
                        }
                      </td>
                      <td className="p-3 text-right font-mono whitespace-nowrap text-white/50">
                        {p.weeksMin}–{p.weeksMax} wks
                      </td>
                      <td className="p-3 text-white/40 max-w-[280px]">{p.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-white/25 mt-2 font-mono">
              * Critical permits marked with orange dot. Timelines based on complete documentation submission.
            </p>
          </section>
        )}

        {/* ── Compliance Checklist ── */}
        <section>
          <SectionLabel>Investor Checklist</SectionLabel>
          <div className="grid sm:grid-cols-2 gap-px" style={{ background: "var(--border)" }}>
            {stage.checklist.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4" style={{ background: "var(--surface-1)" }}>
                <span
                  className="mt-0.5 w-4 h-4 rounded-sm shrink-0 flex items-center justify-center"
                  style={{
                    background: item.critical ? `${ACCENT}25` : "var(--surface-2)",
                    border: `1px solid ${item.critical ? ACCENT : "var(--border)"}`,
                  }}
                >
                  {item.critical && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4.5l2 2 4-4" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div>
                  <p className="text-xs leading-relaxed" style={{ color: item.critical ? "var(--text-primary)" : "var(--text-muted)" }}>{item.item}</p>
                  {item.critical && (
                    <span className="font-mono text-[8px] uppercase tracking-widest mt-0.5 block" style={{ color: ACCENT }}>Critical</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Field Notes ── */}
        <section>
          <SectionLabel>Field Intelligence</SectionLabel>
          <div className="grid sm:grid-cols-2 gap-3">
            {stage.fieldNotes.map((note, i) => (
              <Badge key={i} text={note.text} type={note.type} />
            ))}
          </div>
        </section>

        {/* ── Document Library ── */}
        {docs.length > 0 && (
          <section>
            <SectionLabel>Document Library</SectionLabel>
            <div className="grid sm:grid-cols-2 gap-3">
              {docs.map((doc) => <DocumentCard key={doc.id} doc={doc} />)}
            </div>
          </section>
        )}

        {/* ── Official Sources ── */}
        <section>
          <SectionLabel>Official Sources & References</SectionLabel>
          <div className="grid sm:grid-cols-2 gap-3">
            {stage.officialSources.map((src, i) => {
              const typeColour = { gov: ACCENT, dev: "#3b82f6", research: "#a855f7", ngo: "#22c55e" }[src.type];
              const typeLabel  = { gov: "GOV", dev: "DEVELOPMENT BANK", research: "RESEARCH", ngo: "NGO" }[src.type];
              return (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-4 rounded transition-colors hover:bg-white/5"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-1 rounded-sm shrink-0 mt-0.5" style={{ color: typeColour, background: `${typeColour}15`, border: `1px solid ${typeColour}30` }}>
                    {typeLabel}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white/85">{src.title}</p>
                    <p className="text-xs text-white/35 mt-0.5">{src.org}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* ── Prev / Next ── */}
        <nav className="flex gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          {prev ? (
            <Link
              to="/framework/$stageId"
              params={{ stageId: prev.id }}
              className="flex-1 p-4 rounded transition-all hover:bg-white/5 group"
              style={{ border: "1px solid var(--border)" }}
            >
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1">← Previous Stage</p>
              <p className="font-bold text-white/70 group-hover:text-white transition-colors text-sm">{prev.id} — {prev.title}</p>
            </Link>
          ) : <div className="flex-1" />}

          {next ? (
            <Link
              to="/framework/$stageId"
              params={{ stageId: next.id }}
              className="flex-1 p-4 rounded transition-all hover:bg-white/5 group text-right"
              style={{ border: "1px solid var(--border)" }}
            >
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1">Next Stage →</p>
              <p className="font-bold text-white/70 group-hover:text-white transition-colors text-sm">{next.id} — {next.title}</p>
            </Link>
          ) : (
            <div className="flex-1 p-4 rounded text-right" style={{ border: "1px solid var(--border)" }}>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-1">Framework Complete</p>
              <Link to="/" className="font-bold text-white/40 hover:text-white transition-colors text-sm">Return to Home →</Link>
            </div>
          )}
        </nav>

      </main>

      <footer className="max-w-6xl mx-auto px-4 py-8 border-t mt-6" style={{ borderColor: "var(--border)" }}>
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/20">
          GIDF Stage {stage.id} — The Gentry Lab © 2026 — Cambodia Industrial Intelligence Platform
        </p>
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="h-px flex-1" style={{ background: "var(--border)" }} />
      <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: ACCENT }}>{children}</span>
      <span className="h-px w-8" style={{ background: ACCENT }} />
    </div>
  );
}
