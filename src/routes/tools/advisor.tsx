import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { TopNav } from "@/components/site/TopNav";
import { useCredits, CREDIT_COSTS } from "@/lib/credits";
import PptxGenJS from "pptxgenjs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

export const Route = createFileRoute("/tools/advisor")({
  component: AdvisorPage,
});

/* â─â─ Types â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
type Category = "INVEST" | "DEVELOP" | "FINANCE" | "COMPLY" | "PLAN";
type Step = "select" | "form" | "generating" | "result" | "history";

interface Field {
  id: string;
  label: string;
  type: "select" | "text" | "number";
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

interface BriefType {
  id: string;
  category: Category;
  title: string;
  desc: string;
  audience: string;
  fields: Field[];
  icon: React.ReactNode;
}

interface SavedBrief {
  id: string;
  brief_type: string;
  brief_title: string;
  category: Category;
  fields: Record<string, string>;
  output: string;
  created_at: string;
}

type ReportType = "standard" | "comprehensive";

interface ZoneData { rank: number; name: string; province: string; zone_type: string; lat: number; lng: number; score: number; labour: number; cost: number; permits: number; infrastructure: number; risk: number; }
interface CostData  { zone: string; land_lease_m2_yr: number; build_cost_m2: number; utilities_usd: number; permits_usd: number; factory_size_m2: number; }
interface PieSlice { label: string; value: number; }
interface SiteSelectionChartData {
  type: "site_selection";
  zones: ZoneData[];
  costs: CostData[];
  timeline_weeks: { due_diligence: number; environmental: number; mih_licence: number; cdc_qip: number; construction: number; utilities: number; };
  labour_pool: { zone: string; available: number; }[];
  key_stats: { min_wage_usd: number; power_min: number; power_max: number; sez_permit_months: number; outside_permit_months: number; };
  cost_breakdown?: PieSlice[];
}
interface GenericChartData {
  type: "generic";
  key_metrics: { label: string; value: string; unit: string; }[];
  comparison_table: { headers: string[]; rows: string[][]; };
  timeline_items: { label: string; weeks: number; }[];
  pie_data?: PieSlice[];
}
type ChartData = SiteSelectionChartData | GenericChartData;

function extractChartData(text: string): { chartData: ChartData | null; cleanText: string } {
  const match = text.match(/<CHART_DATA>([\s\S]*?)<\/CHART_DATA>/);
  if (!match) return { chartData: null, cleanText: text };
  try {
    const chartData = JSON.parse(match[1].trim()) as ChartData;
    const cleanText = text.replace(/<CHART_DATA>[\s\S]*?<\/CHART_DATA>/, "").trim();
    return { chartData, cleanText };
  } catch {
    return { chartData: null, cleanText: text };
  }
}

/* â─â─ Chart: Zone Scoring â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function ZoneScoringChart({ zones }: { zones: ZoneData[] }) {
  const data = zones.map(z => ({
    subject: z.name.length > 22 ? z.name.slice(0, 20) + "..." : z.name,
    Labour: z.labour * 10, Cost: z.cost * 10, Permits: z.permits * 10,
    Infrastructure: z.infrastructure * 10, Risk: z.risk * 10,
  }));
  const COLORS = ["#ff5100", "#10b981", "#3b82f6"];
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "#0d0d0e", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: "#ff5100" }}>Zone Scoring Comparison</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={[
          { criterion: "Labour",         ...Object.fromEntries(zones.map(z => [z.name.split(" ")[0], z.labour * 10])) },
          { criterion: "Cost",           ...Object.fromEntries(zones.map(z => [z.name.split(" ")[0], z.cost * 10])) },
          { criterion: "Permits",        ...Object.fromEntries(zones.map(z => [z.name.split(" ")[0], z.permits * 10])) },
          { criterion: "Infrastructure", ...Object.fromEntries(zones.map(z => [z.name.split(" ")[0], z.infrastructure * 10])) },
          { criterion: "Risk",           ...Object.fromEntries(zones.map(z => [z.name.split(" ")[0], z.risk * 10])) },
        ]} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="criterion" tick={{ fill: "rgba(255,255,255,0.40)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.50)" }} />
          {zones.map((z, i) => <Bar key={z.name} dataKey={z.name.split(" ")[0]} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* â─â─ Chart: Cost Comparison â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function CostComparisonChart({ costs }: { costs: CostData[] }) {
  const data = costs.map(c => ({
    zone: c.zone.length > 20 ? c.zone.slice(0, 18) + "..." : c.zone,
    "Land Lease/yr": Math.round(c.land_lease_m2_yr * (c.factory_size_m2 || 8000) / 1000),
    "Build Cost": Math.round(c.build_cost_m2 * (c.factory_size_m2 || 8000) / 1000),
    "Utilities": Math.round(c.utilities_usd / 1000),
    "Permits": Math.round(c.permits_usd / 1000),
  }));
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "#0d0d0e", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: "#ff5100" }}>Estimated Capex Breakdown</p>
      <p className="font-mono text-[8px] mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>USD thousands</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="zone" tick={{ fill: "rgba(255,255,255,0.40)", fontSize: 9 }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" />
          <YAxis tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 11 }} formatter={(v: number) => [`$${v}k`, ""]} />
          <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.50)" }} />
          <Bar dataKey="Land Lease/yr" stackId="a" fill="#ff5100" />
          <Bar dataKey="Build Cost"    stackId="a" fill="#f97316" />
          <Bar dataKey="Utilities"     stackId="a" fill="#fb923c" />
          <Bar dataKey="Permits"       stackId="a" fill="rgba(255,81,0,0.35)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* â─â─ Chart: Timeline â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function TimelineChart({ timeline }: { timeline: SiteSelectionChartData["timeline_weeks"] }) {
  const phases = [
    { label: "Land Due Diligence",   weeks: timeline.due_diligence,  color: "#3b82f6" },
    { label: "Environmental (MoE)",  weeks: timeline.environmental,  color: "#f59e0b" },
    { label: "MIH Licence",          weeks: timeline.mih_licence,    color: "#8b5cf6" },
    { label: "CDC QIP",              weeks: timeline.cdc_qip,        color: "#10b981" },
    { label: "Construction",         weeks: timeline.construction,   color: "#ff5100" },
    { label: "Utility Connection",   weeks: timeline.utilities,      color: "#6366f1" },
  ];
  const total = phases.reduce((s, p) => s + p.weeks, 0);
  let offset = 0;
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "#0d0d0e", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="font-mono text-[9px] uppercase tracking-widest mb-4" style={{ color: "#ff5100" }}>Timeline to First Production</p>
      <div className="space-y-2">
        {phases.map((phase) => {
          const pct = (phase.weeks / total) * 100;
          const left = (offset / total) * 100;
          offset += phase.weeks;
          return (
            <div key={phase.label} className="flex items-center gap-2">
              <span className="text-[10px] w-24 sm:w-40 shrink-0 text-right leading-tight" style={{ color: "rgba(255,255,255,0.50)" }}>{phase.label}</span>
              <div className="flex-1 h-5 rounded overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <div className="h-full rounded flex items-center pl-2 text-[9px] font-bold" style={{ marginLeft: `${left}%`, width: `${pct}%`, backgroundColor: phase.color, color: "#fff", whiteSpace: "nowrap", overflow: "hidden" }}>
                  {phase.weeks >= 6 ? `${phase.weeks}w` : ""}
                </div>
              </div>
              <span className="font-mono text-[9px] w-8 text-right shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>{phase.weeks}w</span>
            </div>
          );
        })}
      </div>
      <p className="font-mono text-[9px] mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>Total: ~{Math.round(total / 4.33)} months · {total} weeks</p>
    </div>
  );
}

/* â─â─ Chart: Key Stats â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function KeyStatsPanel({ stats, zones }: { stats: SiteSelectionChartData["key_stats"]; zones: ZoneData[] }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "#0d0d0e", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="font-mono text-[9px] uppercase tracking-widest mb-4" style={{ color: "#ff5100" }}>Key Market Indicators</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Min. Wage", value: `$${stats.min_wage_usd}`, unit: "/month" },
          { label: "Power Tariff", value: `$${stats.power_min}–$${stats.power_max}`, unit: "/kWh" },
          { label: "SEZ Permits", value: `${stats.sez_permit_months}`, unit: "months" },
          { label: "Outside SEZ", value: `${stats.outside_permit_months}`, unit: "months" },
        ].map(s => (
          <div key={s.label}>
            <p className="font-mono text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.30)" }}>{s.label}</p>
            <p className="text-[18px] font-extrabold leading-none" style={{ color: "#ff5100" }}>{s.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>{s.unit}</p>
          </div>
        ))}
      </div>
      {zones.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="font-mono text-[8px] uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.30)" }}>Zone Rankings</p>
          <div className="flex gap-3 flex-wrap">
            {zones.map((z, i) => (
              <div key={z.name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="font-mono text-[10px] font-bold" style={{ color: ["#ff5100","#10b981","#3b82f6"][i] }}>#{z.rank}</span>
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.75)" }}>{z.name}</span>
                <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.40)" }}>{z.score}/100</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* â─â─ Generic chart panel â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function GenericChartsPanel({ data }: { data: GenericChartData }) {
  return (
    <div className="space-y-4">
      {data.key_metrics?.length > 0 && (
        <div className="rounded-xl p-5" style={{ backgroundColor: "#0d0d0e", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="font-mono text-[9px] uppercase tracking-widest mb-4" style={{ color: "#ff5100" }}>Key Figures</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.key_metrics.map((m, i) => (
              <div key={i}>
                <p className="font-mono text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.30)" }}>{m.label}</p>
                <p className="text-[20px] font-extrabold" style={{ color: "#ff5100" }}>{m.value}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{m.unit}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.timeline_items?.length > 0 && (
        <div className="rounded-xl p-5" style={{ backgroundColor: "#0d0d0e", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: "#ff5100" }}>Timeline</p>
          {(() => {
            const total = data.timeline_items.reduce((s, t) => s + t.weeks, 0);
            let off = 0;
            return data.timeline_items.map((item, i) => {
              const pct = (item.weeks / total) * 100;
              const lft = (off / total) * 100;
              off += item.weeks;
              const COLORS = ["#ff5100","#f97316","#f59e0b","#10b981","#3b82f6","#8b5cf6"];
              return (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] w-36 shrink-0 text-right" style={{ color: "rgba(255,255,255,0.50)" }}>{item.label}</span>
                  <div className="flex-1 h-5 rounded overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded flex items-center pl-2 text-[9px] font-bold" style={{ marginLeft: `${lft}%`, width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length], color: "#fff", whiteSpace: "nowrap", overflow: "hidden" }}>
                      {item.weeks >= 5 ? `${item.weeks}w` : ""}
                    </div>
                  </div>
                  <span className="font-mono text-[9px] w-8 shrink-0 text-right" style={{ color: "rgba(255,255,255,0.35)" }}>{item.weeks}w</span>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

/* â─â─ Category config â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
const CATEGORIES: { id: Category; label: string; color: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: "INVEST", label: "Invest", color: "#ff5100", desc: "International manufacturers & investors",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  },
  {
    id: "DEVELOP", label: "Develop", color: "#10b981", desc: "Landowners, SEZ & park developers",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  },
  {
    id: "FINANCE", label: "Finance", color: "#3b82f6", desc: "Banks, DFIs & private equity",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  },
  {
    id: "COMPLY", label: "Comply", color: "#f59e0b", desc: "Lawyers, consultants & govt liaisons",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  },
  {
    id: "PLAN", label: "Plan", color: "#8b5cf6", desc: "Developers actively building",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
];

const SECTORS = ["Garment & Textiles","Electronics & PCB","Food Processing","Warehousing & Logistics","Automotive / EV","Data Center","Energy / Solar","Pharmaceutical","Furniture","Footwear"];
const PROVINCES = ["Phnom Penh","Kandal","Kampong Speu","Sihanoukville","Svay Rieng","Kampong Cham","Kampot","Siem Reap","Battambang","Other / Recommend best"];
const BUDGET_RANGES = ["Under USD 1M","USD 1M – 5M","USD 5M – 20M","USD 20M – 50M","USD 50M – 100M","Over USD 100M"];
const FACTORY_SIZES = ["Under 1,000 m²","1,000 – 3,000 m²","3,000 – 10,000 m²","10,000 – 30,000 m²","30,000 – 65,000 m²","Over 65,000 m²"];

/* â─â─ Brief definitions â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
const BRIEFS: BriefType[] = [
  /* INVEST */
  {
    id: "site-selection", category: "INVEST", title: "Site Selection Brief",
    desc: "Top 3 zone recommendations scored across 14 criteria — utilities, labour, cost, permits, risk.",
    audience: "Manufacturer evaluating Cambodia entry",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    fields: [
      { id: "sector", label: "Sector", type: "select", options: SECTORS, required: true },
      { id: "factory_size", label: "Factory Size", type: "select", options: FACTORY_SIZES, required: true },
      { id: "budget", label: "Total Investment Budget", type: "select", options: BUDGET_RANGES, required: true },
      { id: "province_preference", label: "Province Preference", type: "select", options: PROVINCES, required: true },
      { id: "priority", label: "Top Priority", type: "select", options: ["Lowest cost","Fastest timeline","Best incentives","Strongest labour pool","Port/export access","Recommend best balance"], required: true },
      { id: "origin_country", label: "Investor Country of Origin", type: "text", placeholder: "e.g. South Korea, China, Japan", required: true },
    ],
  },
  {
    id: "feasibility-snapshot", category: "INVEST", title: "Feasibility Snapshot",
    desc: "Cost breakdown, timeline to production, incentives, and go/no-go assessment for your project.",
    audience: "Investor stress-testing a specific project",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    fields: [
      { id: "sector", label: "Sector", type: "select", options: SECTORS, required: true },
      { id: "factory_size", label: "Factory / Facility Size", type: "select", options: FACTORY_SIZES, required: true },
      { id: "location", label: "Target Location", type: "select", options: PROVINCES, required: true },
      { id: "inside_sez", label: "Inside SEZ or Outside?", type: "select", options: ["Inside SEZ","Outside SEZ / greenfield","Not sure — advise me"], required: true },
      { id: "export_market", label: "Primary Export Market", type: "select", options: ["European Union","United States","ASEAN region","China","Japan / South Korea","Multiple markets"], required: true },
      { id: "production", label: "What will you produce?", type: "text", placeholder: "e.g. garment cutting & sewing, PCB assembly", required: true },
    ],
  },
  {
    id: "incentive-optimizer", category: "INVEST", title: "Incentive Optimizer",
    desc: "Full breakdown of QIP tax holidays, import duty waivers, EBA/GSP access you qualify for.",
    audience: "CFO / tax counsel calculating net investment cost",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    fields: [
      { id: "sector", label: "Sector", type: "select", options: SECTORS, required: true },
      { id: "origin_country", label: "Investor Country of Origin", type: "text", placeholder: "e.g. South Korea", required: true },
      { id: "investment_size", label: "Investment Size (USD)", type: "select", options: BUDGET_RANGES, required: true },
      { id: "export_pct", label: "Export Percentage", type: "select", options: ["Over 80% export","50–80% export","Under 50% export","Domestic market only"], required: true },
      { id: "project_type", label: "Project Type", type: "select", options: ["New greenfield investment","Expansion of existing facility","Relocation from another country","Joint venture with local partner"], required: true },
    ],
  },
  {
    id: "cambodia-vs-region", category: "INVEST", title: "Cambodia vs Region",
    desc: "Side-by-side comparison of Cambodia against Vietnam, Thailand, Indonesia on cost, speed, and risk.",
    audience: "C-suite deciding where in SE Asia to invest",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    fields: [
      { id: "sector", label: "Sector", type: "select", options: SECTORS, required: true },
      { id: "origin_country", label: "Your Country", type: "text", placeholder: "e.g. Japan", required: true },
      { id: "compare_with", label: "Compare Cambodia Against", type: "select", options: ["Vietnam","Thailand","Indonesia","Myanmar","All three (Vietnam, Thailand, Indonesia)"], required: true },
      { id: "key_concern", label: "Your Biggest Decision Factor", type: "select", options: ["Lowest labour cost","Fastest time to production","Best export incentives","Lowest political risk","Strongest supply chain","EU/US market access"], required: true },
      { id: "factory_size", label: "Factory Size", type: "select", options: FACTORY_SIZES, required: true },
    ],
  },

  /* DEVELOP */
  {
    id: "land-viability", category: "DEVELOP", title: "Land Viability Check",
    desc: "Suitability score, development potential, title risk, and recommended path for your land.",
    audience: "Cambodian landowner or local developer",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    fields: [
      { id: "province", label: "Province / Location", type: "select", options: PROVINCES, required: true },
      { id: "land_size", label: "Land Size (hectares)", type: "text", placeholder: "e.g. 12.5 ha", required: true },
      { id: "title_type", label: "Land Title Type", type: "select", options: ["Hard title (LMAP)","Soft title","Unclear / under investigation","Inside SEZ / developer-managed"], required: true },
      { id: "distance_nr", label: "Distance to Nearest National Road", type: "select", options: ["On national road","Under 2 km","2–10 km","Over 10 km","Unknown"], required: true },
      { id: "current_use", label: "Current Land Use", type: "select", options: ["Farmland / rice field","Scrubland / vacant","Existing structure (low-value)","Operating facility","Other"], required: true },
      { id: "development_goal", label: "Your Goal", type: "select", options: ["Sell the land","Lease to a factory tenant","Develop an industrial park / SEZ","Develop for own use"], required: true },
    ],
  },
  {
    id: "tenant-matching", category: "DEVELOP", title: "Tenant Matching",
    desc: "Best-fit sectors for your site, realistic lease rates, and how to position your land to attract tenants.",
    audience: "Developer with land ready to lease",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    fields: [
      { id: "province", label: "Province / Location", type: "select", options: PROVINCES, required: true },
      { id: "land_or_building", label: "What are you offering?", type: "select", options: ["Bare land only","Serviced plot (utilities to boundary)","Shell factory building","Fitted factory (ready to use)","Whole industrial park"], required: true },
      { id: "size", label: "Available Size", type: "text", placeholder: "e.g. 5 ha land / 8,000 m² building", required: true },
      { id: "utilities", label: "Utilities Available", type: "select", options: ["Power + water + road (fully serviced)","Power + road only","Road only","None yet","Inside SEZ (full)"], required: true },
      { id: "asking_rate", label: "Target Lease Rate (USD/m²/yr)", type: "text", placeholder: "e.g. 45 or leave blank for our recommendation" },
    ],
  },
  {
    id: "sez-feasibility", category: "DEVELOP", title: "SEZ / Park Feasibility",
    desc: "Market demand, development cost, tenant profile, and revenue model for building an industrial park.",
    audience: "Developer planning a new industrial park or SEZ",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
    fields: [
      { id: "province", label: "Province / Location", type: "select", options: PROVINCES, required: true },
      { id: "land_size", label: "Total Land Area (ha)", type: "text", placeholder: "e.g. 50 ha", required: true },
      { id: "target_sector", label: "Target Tenant Sector", type: "select", options: [...SECTORS, "Mixed / multi-sector"], required: true },
      { id: "development_budget", label: "Development Budget", type: "select", options: ["Under USD 5M","USD 5M – 20M","USD 20M – 50M","Over USD 50M","Unknown — advise me"], required: true },
      { id: "utilities_status", label: "Utilities Status", type: "select", options: ["EDC power nearby (under 5km)","EDC power available on site","Water source available","All utilities available","Need to develop from scratch"], required: true },
    ],
  },

  /* FINANCE */
  {
    id: "project-bankability", category: "FINANCE", title: "Project Bankability",
    desc: "Bankability score, red flags, collateral assessment, and recommended financing structure.",
    audience: "Bank or DFI evaluating a loan application",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><line x1="9" y1="22" x2="9" y2="12"/><line x1="15" y1="22" x2="15" y2="12"/><line x1="3" y1="12" x2="21" y2="12"/></svg>,
    fields: [
      { id: "sector", label: "Borrower Sector", type: "select", options: SECTORS, required: true },
      { id: "location", label: "Project Location", type: "select", options: PROVINCES, required: true },
      { id: "project_cost", label: "Total Project Cost (USD)", type: "text", placeholder: "e.g. 8,500,000", required: true },
      { id: "loan_amount", label: "Requested Loan Amount (USD)", type: "text", placeholder: "e.g. 6,000,000", required: true },
      { id: "borrower_type", label: "Borrower Type", type: "select", options: ["Local Cambodian company","Foreign-owned company","JV (foreign + local)","Individual / sole trader"], required: true },
      { id: "collateral", label: "Proposed Collateral", type: "select", options: ["Hard title land","Factory building","Both land + building","Soft title land","Equipment only","No hard collateral"], required: true },
    ],
  },
  {
    id: "cost-benchmark", category: "FINANCE", title: "Cost Benchmark",
    desc: "Market rate line-item cost breakdown — is the budget realistic vs what GentryLab has seen delivered?",
    audience: "Bank / investor stress-testing a project budget",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    fields: [
      { id: "building_type", label: "Building Type", type: "select", options: ["Standard factory (portal frame steel)","Warehouse / logistics hub","Food processing facility","Clean room / electronics","Office + factory mix","Cold storage"], required: true },
      { id: "size", label: "Total Built Area (m²)", type: "text", placeholder: "e.g. 12,000", required: true },
      { id: "province", label: "Province", type: "select", options: PROVINCES, required: true },
      { id: "spec_level", label: "Specification Level", type: "select", options: ["Basic (minimum spec)","Standard (market norm)","High-spec (international standard)","Premium / pharma-grade"], required: true },
      { id: "include_utilities", label: "Include Utility Connection Cost?", type: "select", options: ["Yes — include EDC + water connection","No — building only","Not sure — include both scenarios"], required: true },
    ],
  },
  {
    id: "sector-risk", category: "FINANCE", title: "Sector Risk Profile",
    desc: "Risk score, key risk factors, historical comparables, and mitigation options for your exposure.",
    audience: "Credit team sizing sector concentration risk",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    fields: [
      { id: "sector", label: "Sector", type: "select", options: SECTORS, required: true },
      { id: "province", label: "Province / Location", type: "select", options: PROVINCES, required: true },
      { id: "investment_size", label: "Exposure / Investment Size", type: "select", options: BUDGET_RANGES, required: true },
      { id: "horizon", label: "Investment Horizon", type: "select", options: ["1–3 years","3–5 years","5–10 years","Over 10 years"], required: true },
      { id: "concern", label: "Primary Risk Concern", type: "select", options: ["Market demand / vacancy","Regulatory / political","FX / currency","Borrower default","Environmental","All risks"], required: true },
    ],
  },

  /* COMPLY */
  {
    id: "permit-roadmap", category: "COMPLY", title: "Permit Roadmap",
    desc: "Step-by-step permit sequence with ministry, timeline, cost, and the critical mistakes to avoid.",
    audience: "Lawyer or consultant mapping a client's permit path",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    fields: [
      { id: "sector", label: "Project Sector", type: "select", options: SECTORS, required: true },
      { id: "province", label: "Project Location", type: "select", options: PROVINCES, required: true },
      { id: "inside_sez", label: "Inside SEZ or Outside?", type: "select", options: ["Inside SEZ","Outside SEZ","Not decided yet"], required: true },
      { id: "entity_type", label: "Entity Type", type: "select", options: ["100% foreign-owned","Cambodian-owned","JV (foreign + local)","Cambodian subsidiary of foreign company"], required: true },
      { id: "building_type", label: "Facility Type", type: "select", options: ["Factory / production","Warehouse","Office + factory","Food processing","Cold storage","Data center"], required: true },
      { id: "timeline_goal", label: "Target Timeline to Start Production", type: "select", options: ["As fast as possible (under 12 months)","12–18 months","18–24 months","Over 24 months / flexible"], required: true },
    ],
  },
  {
    id: "eba-gsp-check", category: "COMPLY", title: "EBA / GSP Check",
    desc: "Eligibility assessment for EU/US preferential trade access, rules of origin, and documentation needed.",
    audience: "Exporter or trade counsel assessing market access",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    fields: [
      { id: "product", label: "Product / HS Code", type: "text", placeholder: "e.g. garments HS 6203, PCB HS 8534", required: true },
      { id: "export_market", label: "Target Export Market", type: "select", options: ["European Union (EBA)","United States (GSP)","United Kingdom","Japan (EPA)","ASEAN (RCEP)","Multiple markets"], required: true },
      { id: "origin_country", label: "Investor Origin Country", type: "text", placeholder: "e.g. South Korea", required: true },
      { id: "local_content", label: "Estimated Local (Cambodia) Content %", type: "select", options: ["Under 20%","20–40%","40–60%","Over 60%","Not sure"], required: true },
    ],
  },
  {
    id: "environmental-pathway", category: "COMPLY", title: "Environmental Pathway",
    desc: "ECC category, required studies, timeline, cost, and key conditions for your project.",
    audience: "Developer or consultant navigating MoE approval",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    fields: [
      { id: "project_type", label: "Project Type", type: "select", options: ["Factory (manufacturing)","Warehouse / logistics","Industrial park / SEZ","Food processing","Chemical / pharmaceutical","Energy (solar / power plant)","Mixed use"], required: true },
      { id: "size", label: "Project Size", type: "select", options: FACTORY_SIZES, required: true },
      { id: "province", label: "Province", type: "select", options: PROVINCES, required: true },
      { id: "near_sensitive", label: "Near Sensitive Area?", type: "select", options: ["Near river / water body (under 500m)","Near protected forest","Near residential area","Near national park","None of the above","Not sure"], required: true },
    ],
  },

  /* PLAN */
  {
    id: "construction-timeline", category: "PLAN", title: "Construction Timeline",
    desc: "Phase-by-phase construction schedule, critical path, seasonal risks, and recommended start window.",
    audience: "Project manager or developer planning a build",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>,
    fields: [
      { id: "building_type", label: "Building Type", type: "select", options: ["Standard factory","Warehouse / logistics","Food processing","Clean room / electronics","Multi-building industrial campus"], required: true },
      { id: "factory_size", label: "Total Built Area", type: "select", options: FACTORY_SIZES, required: true },
      { id: "province", label: "Province", type: "select", options: PROVINCES, required: true },
      { id: "start_timing", label: "Planned Start Month", type: "select", options: ["November – February (dry season start)","March – May (late dry)","June – October (wet season)","Flexible — advise best window"], required: true },
      { id: "complexity", label: "Project Complexity", type: "select", options: ["Simple shell building","Standard with full MEP","High-spec with clean room / cold chain","Complex multi-building campus"], required: true },
    ],
  },
  {
    id: "epc-budget", category: "PLAN", title: "EPC Budget Builder",
    desc: "Line-item cost estimate for civil, structural, MEP, and utilities — with low/mid/high ranges.",
    audience: "Developer or CFO building a project budget",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    fields: [
      { id: "building_type", label: "Building Type", type: "select", options: ["Standard factory (portal frame steel)","Warehouse / logistics hub","Food processing facility","Clean room / electronics assembly","Office + factory mix","Cold storage"], required: true },
      { id: "size", label: "Total Built Area (m²)", type: "text", placeholder: "e.g. 15,000", required: true },
      { id: "province", label: "Province", type: "select", options: PROVINCES, required: true },
      { id: "spec_level", label: "Specification Level", type: "select", options: ["Basic (minimum viable)","Standard (market norm)","High-spec (international)","Premium / pharma-grade"], required: true },
      { id: "include_site", label: "Include Site Works?", type: "select", options: ["Yes (earthworks, roads, drainage)","Building only","Full package incl. utilities","Not sure — include everything"], required: true },
      { id: "procurement", label: "Procurement Approach", type: "select", options: ["Full turnkey EPC contractor","Design-bid-build (separate)","Owner-managed packages","Not decided yet"], required: true },
    ],
  },
];

/* â─â─ Screen markdown renderer â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-[15px] font-extrabold uppercase tracking-tight mt-6 mb-2" style={{ color: "#ff5100" }}>{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-[13px] font-bold uppercase tracking-tight mt-4 mb-1.5" style={{ color: "rgba(255,255,255,0.85)" }}>{line.slice(4)}</h3>);
    } else if (line.startsWith("#### ")) {
      elements.push(<h4 key={i} className="text-[12px] font-semibold mt-3 mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>{line.slice(5)}</h4>);
    } else if (line.startsWith("> ")) {
      elements.push(<div key={i} className="my-3 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed" style={{ backgroundColor: "rgba(255,81,0,0.08)", borderLeft: "3px solid #ff5100", color: "rgba(255,255,255,0.80)" }}>{inlineMd(line.slice(2))}</div>);
    } else if (line.startsWith("âš ï¸")) {
      elements.push(<div key={i} className="my-3 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed" style={{ backgroundColor: "rgba(245,158,11,0.08)", borderLeft: "3px solid #f59e0b", color: "rgba(255,255,255,0.80)" }}>{inlineMd(line)}</div>);
    } else if (line.startsWith("âœ…")) {
      elements.push(<div key={i} className="my-3 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed" style={{ backgroundColor: "rgba(16,185,129,0.08)", borderLeft: "3px solid #10b981", color: "rgba(255,255,255,0.80)" }}>{inlineMd(line)}</div>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<div key={i} className="flex gap-2 text-[12.5px] my-0.5" style={{ color: "rgba(255,255,255,0.70)" }}><span style={{ color: "#ff5100" }} className="shrink-0 mt-0.5">·</span><span>{inlineMd(line.slice(2))}</span></div>);
    } else if (/^\d+\./.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(<div key={i} className="flex gap-2.5 text-[12.5px] my-1" style={{ color: "rgba(255,255,255,0.70)" }}><span className="font-mono text-[10px] font-bold shrink-0 mt-0.5 w-4" style={{ color: "#ff5100" }}>{num}.</span><span>{inlineMd(line.replace(/^\d+\.\s*/, ""))}</span></div>);
    } else if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) { tableLines.push(lines[i]); i++; }
      elements.push(<ScreenTable key={`t-${i}`} rows={tableLines} />);
      continue;
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="my-4" style={{ borderColor: "rgba(255,255,255,0.08)" }} />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(<p key={i} className="text-[12.5px] leading-relaxed my-1" style={{ color: "rgba(255,255,255,0.65)" }}>{inlineMd(line)}</p>);
    }
    i++;
  }
  return elements;
}

function inlineMd(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} style={{ color: "#ffffff" }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="px-1.5 py-0.5 rounded text-[11px] font-mono" style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100" }}>{p.slice(1, -1)}</code>;
    return p;
  });
}

function ScreenTable({ rows }: { rows: string[] }) {
  const parsed = rows.map(r => r.split("|").map(c => c.trim()).filter(Boolean));
  const headers = parsed[0] ?? [];
  const body = parsed.filter((_, i) => i !== 1).slice(1);
  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-[11.5px]" style={{ borderCollapse: "collapse" }}>
        <thead><tr style={{ borderBottom: "1px solid rgba(255,81,0,0.30)" }}>
          {headers.map((h, i) => <th key={i} className="text-left py-2 px-3 font-mono uppercase tracking-wider text-[10px]" style={{ color: "#ff5100" }}>{h}</th>)}
        </tr></thead>
        <tbody>{body.map((row, ri) => (
          <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {row.map((cell, ci) => <td key={ci} className="py-2 px-3" style={{ color: "rgba(255,255,255,0.65)" }}>{inlineMd(cell)}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/* â─â─ Print markdown renderer â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function renderPrintMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      elements.push(<div key={i} className="pr-h2">{line.slice(3)}</div>);
    } else if (line.startsWith("### ")) {
      elements.push(<div key={i} className="pr-h3">{line.slice(4)}</div>);
    } else if (line.startsWith("#### ")) {
      elements.push(<div key={i} className="pr-h4">{line.slice(5)}</div>);
    } else if (line.startsWith("> ")) {
      elements.push(<div key={i} className="pr-blockquote">{printInline(line.slice(2))}</div>);
    } else if (line.startsWith("âš ï¸")) {
      elements.push(<div key={i} className="pr-warn">{printInline(line)}</div>);
    } else if (line.startsWith("âœ…")) {
      elements.push(<div key={i} className="pr-good">{printInline(line)}</div>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<div key={i} className="pr-li"><span className="pr-li-dot">·</span><span>{printInline(line.slice(2))}</span></div>);
    } else if (/^\d+\./.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(<div key={i} className="pr-ol"><span className="pr-ol-num">{num}.</span><span>{printInline(line.replace(/^\d+\.\s*/, ""))}</span></div>);
    } else if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) { tableLines.push(lines[i]); i++; }
      elements.push(<PrintTable key={`pt-${i}`} rows={tableLines} />);
      continue;
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="pr-divider" />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: "4pt" }} />);
    } else {
      elements.push(<div key={i} className="pr-p">{printInline(line)}</div>);
    }
    i++;
  }
  return elements;
}

function printInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, j) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={j}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={j} style={{ fontFamily: "monospace", background: "#fff3ee", color: "#cc3300", padding: "0 3pt", borderRadius: "2pt", fontSize: "8.5pt" }}>{p.slice(1, -1)}</code>;
    return p;
  });
}

function PrintTable({ rows }: { rows: string[] }) {
  const parsed = rows.map(r => r.split("|").map(c => c.trim()).filter(Boolean));
  const headers = parsed[0] ?? [];
  const body = parsed.filter((_, i) => i !== 1).slice(1);
  return (
    <table className="pr-table">
      <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>{body.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{printInline(cell)}</td>)}</tr>)}</tbody>
    </table>
  );
}

/* â─â─ SVG Print Charts â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
const PF = { body: "'Inter','Helvetica Neue',Arial,sans-serif", head: "'Inter','Helvetica Neue',Arial,sans-serif" } as const;
const PCOLS = ["#cc3300", "#1a5c9e", "#217a4b", "#7b3fa0", "#b86e00"] as const;

function SvgHorizBar({ label, value, max, color, width = 460 }: { label: string; value: number; max: number; color: string; width?: number }) {
  const barW = Math.max(2, Math.round((value / max) * (width - 130)));
  return (
    <g>
      <text x="0" y="11" style={{ fontFamily: PF.body, fontSize: "8pt", fill: "#444" }}>{label}</text>
      <rect x="130" y="0" width={width - 130} height="13" fill="#f0f0f0" rx="2" />
      <rect x="130" y="0" width={barW} height="13" fill={color} rx="2" />
      <text x={130 + barW + 4} y="10" style={{ fontFamily: PF.head, fontSize: "7.5pt", fontWeight: "bold", fill: color }}>{value}</text>
    </g>
  );
}

function SvgZoneScoringChart({ zones }: { zones: ZoneData[] }) {
  const criteria = [
    { key: "labour" as const, label: "Labour Pool" },
    { key: "cost" as const, label: "Cost Index" },
    { key: "permits" as const, label: "Permit Speed" },
    { key: "infrastructure" as const, label: "Infrastructure" },
    { key: "risk" as const, label: "Risk Score" },
  ];
  const rowH = 20, groupH = criteria.length * rowH + 14;
  const totalH = zones.length * groupH + 40;
  return (
    <svg width="100%" viewBox={`0 0 540 ${totalH}`} style={{ display: "block", marginBottom: "8pt" }}>
      <text x="0" y="12" style={{ fontFamily: PF.head, fontSize: "7pt", fill: "#888", textTransform: "uppercase", letterSpacing: "1" }}>ZONE SCORING — CRITERIA BREAKDOWN (out of 10)</text>
      {zones.map((zone, zi) => {
        const gy = 22 + zi * groupH;
        return (
          <g key={zone.name} transform={`translate(0,${gy})`}>
            <rect x="0" y="0" width="540" height={groupH - 4} fill={zi % 2 === 0 ? "#fff8f6" : "#f9f9f9"} rx="3" />
            <text x="6" y="11" style={{ fontFamily: PF.head, fontSize: "8.5pt", fontWeight: "bold", fill: PCOLS[zi % PCOLS.length] }}>
              #{zone.rank} {zone.name}
            </text>
            <text x="6" y="21" style={{ fontFamily: PF.body, fontSize: "7pt", fill: "#777" }}>{zone.province} · {zone.zone_type} · Overall: {zone.score}/100</text>
            {criteria.map((c, ci) => {
              const val = zone[c.key] * 10;
              const barX = 140, barMaxW = 360, barW = Math.max(2, Math.round((val / 100) * barMaxW));
              const y = 26 + ci * rowH;
              return (
                <g key={c.key} transform={`translate(0,${y})`}>
                  <text x="6" y="10" style={{ fontFamily: PF.body, fontSize: "7.5pt", fill: "#555" }}>{c.label}</text>
                  <rect x={barX} y="1" width={barMaxW} height="11" fill="#ebebeb" rx="2" />
                  <rect x={barX} y="1" width={barW} height="11" fill={PCOLS[zi % PCOLS.length]} rx="2" opacity="0.85" />
                  <text x={barX + barW + 4} y="10" style={{ fontFamily: PF.head, fontSize: "7pt", fontWeight: "bold", fill: PCOLS[zi % PCOLS.length] }}>{zone[c.key]}/10</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function SvgCostChart({ costs }: { costs: CostData[] }) {
  const fields: { key: keyof CostData; label: string }[] = [
    { key: "land_lease_m2_yr", label: "Land Lease /m²/yr ($)" },
    { key: "build_cost_m2", label: "Build Cost /m² ($)" },
  ];
  const rowH = 18, groupH = fields.length * rowH + 18;
  const totalH = costs.length * groupH + 40;
  const maxVal = Math.max(...costs.flatMap(c => [c.land_lease_m2_yr, c.build_cost_m2]));
  return (
    <svg width="100%" viewBox={`0 0 540 ${totalH}`} style={{ display: "block", marginBottom: "8pt" }}>
      <text x="0" y="12" style={{ fontFamily: PF.head, fontSize: "7pt", fill: "#888", textTransform: "uppercase", letterSpacing: "1" }}>COST COMPARISON BY ZONE</text>
      {costs.map((c, i) => {
        const gy = 22 + i * groupH;
        return (
          <g key={c.zone} transform={`translate(0,${gy})`}>
            <rect x="0" y="0" width="540" height={groupH - 4} fill={i % 2 === 0 ? "#fff8f6" : "#f9f9f9"} rx="3" />
            <text x="6" y="13" style={{ fontFamily: PF.head, fontSize: "8.5pt", fontWeight: "bold", fill: PCOLS[i % PCOLS.length] }}>{c.zone}</text>
            {fields.map((f, fi) => {
              const val = c[f.key] as number;
              const barX = 160, barMaxW = 340, barW = Math.max(2, Math.round((val / maxVal) * barMaxW));
              const y = 17 + fi * rowH;
              return (
                <g key={f.key} transform={`translate(0,${y})`}>
                  <text x="6" y="10" style={{ fontFamily: PF.body, fontSize: "7.5pt", fill: "#555" }}>{f.label}</text>
                  <rect x={barX} y="1" width={barMaxW} height="11" fill="#ebebeb" rx="2" />
                  <rect x={barX} y="1" width={barW} height="11" fill={PCOLS[i % PCOLS.length]} rx="2" opacity="0.85" />
                  <text x={barX + barW + 4} y="10" style={{ fontFamily: PF.head, fontSize: "7pt", fontWeight: "bold", fill: PCOLS[i % PCOLS.length] }}>${val}</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function SvgTimeline({ timeline }: { timeline: SiteSelectionChartData["timeline_weeks"] }) {
  const phases = [
    { label: "Land Due Diligence", weeks: timeline.due_diligence },
    { label: "Environmental (MoE)", weeks: timeline.environmental },
    { label: "MIH Licence", weeks: timeline.mih_licence },
    { label: "CDC QIP", weeks: timeline.cdc_qip },
    { label: "Construction", weeks: timeline.construction },
    { label: "Utility Connection", weeks: timeline.utilities },
  ];
  const total = phases.reduce((s, p) => s + p.weeks, 0);
  const W = 380, H = phases.length * 22 + 50;
  let off = 0;
  return (
    <svg width="100%" viewBox={`0 0 540 ${H}`} style={{ display: "block", marginBottom: "8pt" }}>
      <text x="0" y="12" style={{ fontFamily: PF.head, fontSize: "7pt", fill: "#888", textTransform: "uppercase", letterSpacing: "1" }}>
        TIMELINE TO FIRST PRODUCTION · TOTAL ~{Math.round(total / 4.33)} MONTHS
      </text>
      {phases.map((p, i) => {
        const x = 150 + Math.round((off / total) * W);
        const w = Math.max(2, Math.round((p.weeks / total) * W));
        const y = 20 + i * 22;
        off += p.weeks;
        const col = PCOLS[i % PCOLS.length];
        return (
          <g key={p.label}>
            <text x="145" y={y + 13} textAnchor="end" style={{ fontFamily: PF.body, fontSize: "7.5pt", fill: "#555" }}>{p.label}</text>
            <rect x="150" y={y} width={W} height="15" fill="#ebebeb" rx="2" />
            <rect x={x} y={y} width={w} height="15" fill={col} rx="2" />
            {w > 22 && (
              <text x={x + w / 2} y={y + 11} textAnchor="middle" style={{ fontFamily: PF.head, fontSize: "6.5pt", fontWeight: "bold", fill: "#fff" }}>{p.weeks}w</text>
            )}
            <text x={x + w + 4} y={y + 11} style={{ fontFamily: PF.head, fontSize: "7pt", fill: col, fontWeight: "bold" }}>{p.weeks}w</text>
          </g>
        );
      })}
    </svg>
  );
}

function SvgKeyStats({ stats, zones }: { stats: SiteSelectionChartData["key_stats"]; zones: ZoneData[] }) {
  const items = [
    { label: "Min. Wage", value: `$${stats.min_wage_usd}`, unit: "/month" },
    { label: "Power Tariff", value: `$${stats.power_min}–$${stats.power_max}`, unit: "/kWh" },
    { label: "SEZ Permits", value: `${stats.sez_permit_months}mo`, unit: "inside SEZ" },
    { label: "Outside SEZ", value: `${stats.outside_permit_months}mo`, unit: "permit time" },
  ];
  return (
    <svg width="100%" viewBox="0 0 540 70" style={{ display: "block", marginBottom: "8pt" }}>
      {items.map((item, i) => {
        const x = i * 135;
        return (
          <g key={item.label} transform={`translate(${x},0)`}>
            <rect x="0" y="0" width="128" height="65" fill={i % 2 === 0 ? "#fff8f6" : "#f5f5f5"} rx="4" />
            <rect x="0" y="0" width="4" height="65" fill={PCOLS[i % PCOLS.length]} rx="2" />
            <text x="10" y="15" style={{ fontFamily: PF.head, fontSize: "6.5pt", fill: "#888", textTransform: "uppercase" }}>{item.label}</text>
            <text x="10" y="40" style={{ fontFamily: PF.head, fontSize: "16pt", fontWeight: "bold", fill: PCOLS[i % PCOLS.length] }}>{item.value}</text>
            <text x="10" y="56" style={{ fontFamily: PF.body, fontSize: "7pt", fill: "#888" }}>{item.unit}</text>
          </g>
        );
      })}
    </svg>
  );
}

function SvgGenericMetrics({ metrics }: { metrics: GenericChartData["key_metrics"] }) {
  const cols = Math.min(metrics.length, 4);
  const boxW = Math.floor(540 / cols) - 4;
  return (
    <svg width="100%" viewBox={`0 0 540 70`} style={{ display: "block", marginBottom: "8pt" }}>
      {metrics.slice(0, 4).map((m, i) => {
        const x = i * (boxW + 4);
        return (
          <g key={m.label} transform={`translate(${x},0)`}>
            <rect x="0" y="0" width={boxW} height="65" fill={i % 2 === 0 ? "#fff8f6" : "#f5f5f5"} rx="4" />
            <rect x="0" y="0" width="4" height="65" fill={PCOLS[i % PCOLS.length]} rx="2" />
            <text x="10" y="15" style={{ fontFamily: PF.head, fontSize: "6.5pt", fill: "#888" }}>{m.label}</text>
            <text x="10" y="42" style={{ fontFamily: PF.head, fontSize: "14pt", fontWeight: "bold", fill: PCOLS[i % PCOLS.length] }}>{m.value}</text>
            <text x="10" y="57" style={{ fontFamily: PF.body, fontSize: "7pt", fill: "#888" }}>{m.unit}</text>
          </g>
        );
      })}
    </svg>
  );
}

function SvgGenericTimeline({ items }: { items: GenericChartData["timeline_items"] }) {
  const total = items.reduce((s, t) => s + t.weeks, 0);
  const W = 380, H = items.length * 22 + 50;
  let off = 0;
  return (
    <svg width="100%" viewBox={`0 0 540 ${H}`} style={{ display: "block", marginBottom: "8pt" }}>
      <text x="0" y="12" style={{ fontFamily: PF.head, fontSize: "7pt", fill: "#888", textTransform: "uppercase", letterSpacing: "1" }}>
        TIMELINE · TOTAL {total} WEEKS
      </text>
      {items.map((item, i) => {
        const x = 145 + Math.round((off / total) * W);
        const w = Math.max(2, Math.round((item.weeks / total) * W));
        const y = 20 + i * 22;
        off += item.weeks;
        const col = PCOLS[i % PCOLS.length];
        return (
          <g key={i}>
            <text x="140" y={y + 12} textAnchor="end" style={{ fontFamily: PF.body, fontSize: "7.5pt", fill: "#555" }}>{item.label}</text>
            <rect x="145" y={y} width={W} height="15" fill="#ebebeb" rx="2" />
            <rect x={x} y={y} width={w} height="15" fill={col} rx="2" />
            {w > 22 && <text x={x + w / 2} y={y + 11} textAnchor="middle" style={{ fontFamily: PF.head, fontSize: "6.5pt", fontWeight: "bold", fill: "#fff" }}>{item.weeks}w</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* â─â─ SVG Pie Chart â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function SvgPieChart({ slices, title }: { slices: PieSlice[]; title: string }) {
  const total = slices.reduce((s, p) => s + p.value, 0);
  const cx = 100, cy = 90, r = 78;
  let angle = -Math.PI / 2;
  const paths: React.ReactNode[] = [];
  const legends: React.ReactNode[] = [];
  slices.forEach((sl, i) => {
    const frac = sl.value / total;
    const a0 = angle, a1 = angle + frac * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    const mid = (a0 + a1) / 2;
    const lx = cx + (r + 14) * Math.cos(mid), ly = cy + (r + 14) * Math.sin(mid);
    const col = PCOLS[i % PCOLS.length];
    paths.push(
      <path key={i} d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`}
        fill={col} stroke="#fff" strokeWidth="1.5" />
    );
    if (frac > 0.05) {
      paths.push(
        <text key={`l${i}`} x={lx} y={ly} textAnchor="middle"
          style={{ fontFamily: PF.head, fontSize: "7pt", fontWeight: "bold", fill: col }}>
          {Math.round(frac * 100)}%
        </text>
      );
    }
    legends.push(
      <g key={i} transform={`translate(210, ${10 + i * 22})`}>
        <rect x="0" y="2" width="10" height="10" fill={col} rx="2" />
        <text x="15" y="12" style={{ fontFamily: PF.body, fontSize: "8.5pt", fill: "#333" }}>{sl.label}</text>
        <text x="290" y="12" textAnchor="end" style={{ fontFamily: PF.head, fontSize: "8pt", fontWeight: "bold", fill: col }}>{sl.value}%</text>
      </g>
    );
    angle = a1;
  });
  return (
    <svg width="100%" viewBox="0 0 540 190" style={{ display: "block", marginBottom: "8pt" }}>
      <text x="0" y="12" style={{ fontFamily: PF.head, fontSize: "7pt", fill: "#888", textTransform: "uppercase", letterSpacing: "1" }}>{title.toUpperCase()}</text>
      <g transform="translate(0,18)">{paths}</g>
      <g transform="translate(0,10)">{legends}</g>
    </svg>
  );
}

/* â─â─ SVG Cambodia Province Map â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
// Converts lat/lng to SVG x/y within a 400Ã—300 viewport
// Cambodia bounds: lat 10.4–14.7, lng 102.35–107.62
function latLngToSvg(lat: number, lng: number): [number, number] {
  const x = ((lng - 102.35) / (107.62 - 102.35)) * 400;
  const y = ((14.7 - lat) / (14.7 - 10.4)) * 300;
  return [Math.round(x), Math.round(y)];
}
const CAMBODIA_PATH =
  "M 0,22 43,1 128,0 281,20 381,23 387,88 339,193 379,253 357,283 325,300 283,300 202,297 163,281 133,265 89,259 42,201 0,139 0,72 Z";
const KH_PROVINCES: { name: string; lat: number; lng: number }[] = [
  { name: "Phnom Penh", lat: 11.56, lng: 104.93 },
  { name: "Kandal", lat: 11.28, lng: 104.95 },
  { name: "Kampong Speu", lat: 11.45, lng: 104.52 },
  { name: "Sihanoukville", lat: 10.61, lng: 103.51 },
  { name: "Svay Rieng", lat: 11.08, lng: 105.80 },
  { name: "Kampong Cham", lat: 11.99, lng: 105.46 },
  { name: "Siem Reap", lat: 13.36, lng: 103.86 },
  { name: "Battambang", lat: 13.09, lng: 103.20 },
  { name: "Bavet SEZ", lat: 11.07, lng: 106.00 },
  { name: "Koh Kong", lat: 11.61, lng: 103.00 },
];
function SvgCambodiaMap({ zones }: { zones: ZoneData[] }) {
  return (
    <svg width="100%" viewBox="0 0 540 330" style={{ display: "block", marginBottom: "8pt" }}>
      <text x="0" y="12" style={{ fontFamily: PF.head, fontSize: "7pt", fill: "#888", textTransform: "uppercase", letterSpacing: "1" }}>
        ZONE LOCATIONS — CAMBODIA MAP
      </text>
      <g transform="translate(60,18)">
        {/* Country fill */}
        <path d={CAMBODIA_PATH} fill="#f5f0ee" stroke="#ccc" strokeWidth="1.5" />
        {/* Tonle Sap lake */}
        <ellipse cx="150" cy="115" rx="38" ry="26" fill="#d4e8f5" stroke="#aac8e0" strokeWidth="0.8" />
        <text x="150" y="118" textAnchor="middle" style={{ fontFamily: PF.body, fontSize: "5.5pt", fill: "#6a9fbf" }}>Tonle Sap</text>
        {/* Province dots */}
        {KH_PROVINCES.map(p => {
          const [x, y] = latLngToSvg(p.lat, p.lng);
          return (
            <g key={p.name}>
              <circle cx={x} cy={y} r="2.5" fill="#ccc" />
              <text x={x + 4} y={y + 4} style={{ fontFamily: PF.body, fontSize: "5pt", fill: "#999" }}>{p.name}</text>
            </g>
          );
        })}
        {/* Zone pins */}
        {zones.map((z, i) => {
          const [x, y] = latLngToSvg(z.lat, z.lng);
          const col = PCOLS[i % PCOLS.length];
          return (
            <g key={z.name}>
              <circle cx={x} cy={y} r="8" fill={col} stroke="#fff" strokeWidth="1.5" opacity="0.92" />
              <text x={x} y={y + 4} textAnchor="middle" style={{ fontFamily: PF.head, fontSize: "7.5pt", fontWeight: "bold", fill: "#fff" }}>{z.rank}</text>
              <text x={x + 11} y={y - 4} style={{ fontFamily: PF.head, fontSize: "7pt", fontWeight: "bold", fill: col }}>{z.name}</text>
              <text x={x + 11} y={y + 6} style={{ fontFamily: PF.body, fontSize: "6pt", fill: "#888" }}>{z.province} · Score {z.score}</text>
            </g>
          );
        })}
      </g>
      {/* Legend */}
      {zones.map((z, i) => (
        <g key={z.name} transform={`translate(480, ${20 + i * 18})`}>
          <circle cx="4" cy="4" r="5" fill={PCOLS[i % PCOLS.length]} />
          <text x="12" y="8" style={{ fontFamily: PF.head, fontSize: "6.5pt", fill: "#333", fontWeight: "bold" }}>#{z.rank} {z.name.split(" ").slice(0, 2).join(" ")}</text>
        </g>
      ))}
    </svg>
  );
}

/* â─â─ SVG Labour Pool Bar Chart â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function SvgLabourPoolChart({ labour }: { labour: SiteSelectionChartData["labour_pool"] }) {
  const max = Math.max(...labour.map(l => l.available));
  const H = labour.length * 28 + 30;
  return (
    <svg width="100%" viewBox={`0 0 540 ${H}`} style={{ display: "block", marginBottom: "8pt" }}>
      <text x="0" y="12" style={{ fontFamily: PF.head, fontSize: "7pt", fill: "#888", textTransform: "uppercase", letterSpacing: "1" }}>AVAILABLE LABOUR POOL BY ZONE</text>
      {labour.map((l, i) => {
        const barW = Math.max(2, Math.round((l.available / max) * 360));
        const y = 20 + i * 28;
        const col = PCOLS[i % PCOLS.length];
        return (
          <g key={l.zone}>
            <text x="145" y={y + 13} textAnchor="end" style={{ fontFamily: PF.body, fontSize: "8pt", fill: "#444" }}>{l.zone}</text>
            <rect x="150" y={y} width={360} height="18" fill="#f0f0f0" rx="3" />
            <rect x="150" y={y} width={barW} height="18" fill={col} rx="3" opacity="0.85" />
            {barW > 40 && <text x={152 + barW / 2} y={y + 13} textAnchor="middle" style={{ fontFamily: PF.head, fontSize: "7.5pt", fontWeight: "bold", fill: "#fff" }}>{l.available.toLocaleString()}</text>}
            {barW <= 40 && <text x={155 + barW} y={y + 13} style={{ fontFamily: PF.head, fontSize: "7.5pt", fontWeight: "bold", fill: col }}>{l.available.toLocaleString()}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* â─â─ Print Report component â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function PrintReport({
  brief, form, output, savedBriefId, generatedAt, chartData, reportType,
}: {
  brief: BriefType; form: Record<string, string>; output: string;
  savedBriefId: string | null; generatedAt: Date;
  chartData: ChartData | null; reportType: ReportType;
}) {
  const cat = CATEGORIES.find(c => c.id === brief.category)!;
  const refId = savedBriefId ? savedBriefId.slice(0, 8).toUpperCase() : "DRAFT";
  const dateStr = generatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = generatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const labelMap: Record<string, string> = {};
  brief.fields.forEach(f => { labelMap[f.id] = f.label; });
  const inputPairs = Object.entries(form).filter(([, v]) => v).map(([k, v]) => ({ key: labelMap[k] ?? k, val: v }));

  const th = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: "4pt 7pt", textAlign: "left", fontFamily: PF.head, fontSize: "7.5pt",
    color: "#555", borderBottom: "1pt solid #ddd", backgroundColor: "#fff3ee", ...extra,
  });
  const td = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: "4pt 7pt", fontFamily: PF.body, fontSize: "9pt", borderBottom: "1pt solid #f0f0f0", ...extra,
  });

  const ssd = chartData?.type === "site_selection" ? chartData as SiteSelectionChartData : null;
  const gd  = chartData?.type === "generic"        ? chartData as GenericChartData        : null;

  return (
    <div className="advisor-print pr-root" style={{ backgroundColor: "#ffffff", color: "#000000" }}>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          PAGE 1 — MINIMAL COVER
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{ pageBreakAfter: "always", minHeight: "270mm", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>

        {/* Thin top accent line */}
        <div style={{ height: "4pt", backgroundColor: "#cc3300" }} />

        {/* Cover body — centred, lots of white space */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 48pt" }}>

          {/* Brand wordmark */}
          <div style={{ fontFamily: PF.head, fontSize: "8pt", fontWeight: 700, color: "#cc3300", letterSpacing: "0.35em", textTransform: "uppercase", marginBottom: "48pt" }}>
            THE GENTRY LAB
          </div>

          {/* Category label */}
          <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#999", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "10pt" }}>
            {cat.label} · {brief.audience}
          </div>

          {/* Main title */}
          <div style={{ fontFamily: PF.head, fontSize: "32pt", fontWeight: 900, color: "#111", lineHeight: 1.1, marginBottom: "16pt", maxWidth: "380pt" }}>
            {brief.title}
          </div>

          {/* Thin rule */}
          <div style={{ width: "40pt", height: "2pt", backgroundColor: "#cc3300", marginBottom: "20pt" }} />

          {/* Report type + date only */}
          <div style={{ fontFamily: PF.head, fontSize: "9pt", color: "#666", marginBottom: "4pt" }}>
            {reportType === "comprehensive" ? "Comprehensive Analysis Report" : "Standard Advisory Brief"}
          </div>
          <div style={{ fontFamily: PF.body, fontSize: "9pt", color: "#aaa" }}>
            {dateStr}
          </div>
        </div>

        {/* Cover bottom bar */}
        <div style={{ padding: "14pt 48pt", borderTop: "1pt solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: "7pt", color: "#bbb", letterSpacing: "0.1em" }}>
            REF #{refId} · AI INDUSTRIAL ADVISOR · CAMBODIA
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "7pt", color: "#bbb" }}>
            thegentrylab.io
          </div>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          PAGE 2 — INFOGRAPHIC / DATA VISUALISATION
          (all reports get this page)
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{ pageBreakAfter: "always", backgroundColor: "#ffffff" }}>
        <div className="pr-header">
          <div>
            <div className="pr-brand-name">THE GENTRY LAB</div>
            <div className="pr-brand-tag">AI Industrial Advisor · Cambodia</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="pr-meta-label">{brief.title}</div>
            <div className="pr-meta-label">Ref #{refId} · {dateStr}</div>
          </div>
        </div>

        {/* Parameters strip */}
        {inputPairs.length > 0 && (
          <div style={{ marginBottom: "18pt", padding: "10pt 12pt", backgroundColor: "#f9f9f9", border: "1pt solid #eee", borderLeft: "3pt solid #cc3300", borderRadius: "0 4pt 4pt 0" }}>
            <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#cc3300", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8pt" }}>Analysis Parameters</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4pt 32pt" }}>
              {inputPairs.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "8pt", alignItems: "baseline" }}>
                  <span style={{ fontFamily: PF.head, fontSize: "6.5pt", color: "#aaa", minWidth: "80pt", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.key}</span>
                  <span style={{ fontFamily: PF.body, fontSize: "9pt", color: "#111", fontWeight: 600 }}>{p.val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* â─â─ Site Selection visualisations â─â─ */}
        {ssd && (
          <>
            {/* Row 1: Key stats infographic + Pie chart */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12pt", marginBottom: "14pt" }}>
              <div>
                <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Key Market Indicators</div>
                <SvgKeyStats stats={ssd.key_stats} zones={ssd.zones} />
              </div>
              {ssd.cost_breakdown && ssd.cost_breakdown.length > 0 && (
                <div>
                  <SvgPieChart slices={ssd.cost_breakdown} title="Total Investment Breakdown (%)" />
                </div>
              )}
            </div>

            {/* Cambodia map */}
            <div style={{ marginBottom: "14pt" }}>
              <SvgCambodiaMap zones={ssd.zones} />
            </div>

            {/* Zone scoring chart */}
            <div style={{ marginBottom: "14pt" }}>
              <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Zone Scoring — Criteria Breakdown</div>
              <SvgZoneScoringChart zones={ssd.zones} />
            </div>

            {/* Gantt chart / timeline */}
            <div style={{ marginBottom: "14pt" }}>
              <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Project Timeline — Gantt Chart</div>
              <SvgTimeline timeline={ssd.timeline_weeks} />
            </div>

            {/* Cost comparison + Labour side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12pt", marginBottom: "14pt" }}>
              <div>
                <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Cost Comparison by Zone</div>
                <SvgCostChart costs={ssd.costs} />
              </div>
              {ssd.labour_pool?.length > 0 && (
                <div>
                  <SvgLabourPoolChart labour={ssd.labour_pool} />
                </div>
              )}
            </div>

            {/* Capex detail table */}
            <div style={{ marginBottom: "14pt" }}>
              <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Estimated Capex Detail (USD)</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Zone","Land /m²/yr","Build /m²","Utilities /mo","Permits","Area"].map(h => <th key={h} style={th({ textAlign: h === "Zone" ? "left" : "center" })}>{h}</th>)}</tr></thead>
                <tbody>{ssd.costs.map((c, i) => (
                  <tr key={c.zone} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={td({ fontWeight: 700, color: PCOLS[i % PCOLS.length] })}>{c.zone}</td>
                    <td style={td({ textAlign: "center" })}>${c.land_lease_m2_yr}</td>
                    <td style={td({ textAlign: "center" })}>${c.build_cost_m2}</td>
                    <td style={td({ textAlign: "center" })}>${c.utilities_usd.toLocaleString()}</td>
                    <td style={td({ textAlign: "center" })}>${c.permits_usd.toLocaleString()}</td>
                    <td style={td({ textAlign: "center" })}>{c.factory_size_m2.toLocaleString()} m²</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>

            {/* Rankings table */}
            <div style={{ marginBottom: "14pt" }}>
              <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Zone Rankings Summary</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Rank","Zone","Province","Type","Score","Labour","Cost","Permits","Infra","Risk"].map(h => <th key={h} style={th({ textAlign: "center" })}>{h}</th>)}</tr></thead>
                <tbody>{ssd.zones.map((z, i) => (
                  <tr key={z.name} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={td({ textAlign: "center", fontWeight: 700, color: PCOLS[i % PCOLS.length] })}>#{z.rank}</td>
                    <td style={td({ fontWeight: 700 })}>{z.name}</td>
                    <td style={td({ color: "#666" })}>{z.province}</td>
                    <td style={td({ color: "#888", fontSize: "8pt" })}>{z.zone_type}</td>
                    <td style={td({ textAlign: "center", fontWeight: 700, color: "#cc3300" })}>{z.score}</td>
                    <td style={td({ textAlign: "center" })}>{z.labour}/10</td>
                    <td style={td({ textAlign: "center" })}>{z.cost}/10</td>
                    <td style={td({ textAlign: "center" })}>{z.permits}/10</td>
                    <td style={td({ textAlign: "center" })}>{z.infrastructure}/10</td>
                    <td style={td({ textAlign: "center" })}>{z.risk}/10</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}

        {/* â─â─ Generic brief visualisations â─â─ */}
        {gd && (
          <>
            {/* Key metrics infographic */}
            {gd.key_metrics?.length > 0 && (
              <div style={{ marginBottom: "14pt" }}>
                <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Key Figures — Infographic</div>
                <SvgGenericMetrics metrics={gd.key_metrics} />
              </div>
            )}

            {/* Pie chart + Timeline side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12pt", marginBottom: "14pt" }}>
              {gd.pie_data && gd.pie_data.length > 0 && (
                <div>
                  <SvgPieChart slices={gd.pie_data} title="Distribution Breakdown" />
                </div>
              )}
              {gd.timeline_items?.length > 0 && (
                <div>
                  <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Timeline / Gantt Chart</div>
                  <SvgGenericTimeline items={gd.timeline_items} />
                </div>
              )}
            </div>

            {/* Comparison table */}
            {gd.comparison_table?.headers?.length > 0 && (
              <div style={{ marginBottom: "14pt" }}>
                <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Comparative Analysis</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{gd.comparison_table.headers.map(h => <th key={h} style={th()}>{h}</th>)}</tr></thead>
                  <tbody>{gd.comparison_table.rows.map((row, i) => <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}>{row.map((cell, j) => <td key={j} style={td()}>{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          PAGE 3+ — BRIEF CONTENT
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{ backgroundColor: "#ffffff" }}>

        {/* Running header */}
        <div className="pr-header">
          <div>
            <div className="pr-brand-name">THE GENTRY LAB</div>
            <div className="pr-brand-tag">AI Industrial Advisor · Cambodia</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="pr-meta-label">{brief.title}</div>
            <div className="pr-meta-label">Ref #{refId} · {dateStr}</div>
          </div>
        </div>

        <div style={{ marginBottom: "16pt" }}>
          {renderPrintMarkdown(output)}
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          LAST PAGE — DISCLAIMER + METADATA
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{ pageBreakBefore: "always", backgroundColor: "#ffffff", color: "#000000" }}>

        {/* Running header */}
        <div className="pr-header">
          <div>
            <div className="pr-brand-name">THE GENTRY LAB</div>
            <div className="pr-brand-tag">AI Industrial Advisor · Cambodia</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="pr-meta-label">Ref #{refId} · {dateStr}</div>
          </div>
        </div>

        {/* Data sources — compact */}
        <div style={{ marginBottom: "18pt" }}>
          <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#cc3300", textTransform: "uppercase", letterSpacing: "0.15em", borderBottom: "1pt solid #eee", paddingBottom: "4pt", marginBottom: "10pt" }}>
            Data Sources
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4pt 24pt" }}>
            {[
              { ref: "1", src: "CDC Cambodia — QIP Registry", url: "cdc.gov.kh" },
              { ref: "2", src: "SEZB — SEZ Directory", url: "sezb.gov.kh" },
              { ref: "3", src: "Ministry of Industry (MIH)", url: "mih.gov.kh" },
              { ref: "4", src: "Ministry of Environment (MoE)", url: "moe.gov.kh" },
              { ref: "5", src: "Ã‰lectricitÃ© du Cambodge (EDC)", url: "edc.com.kh" },
              { ref: "6", src: "MoLVT — Minimum Wage Orders", url: "molvt.gov.kh" },
              { ref: "7", src: "GDCE — Customs & Duty Schedule", url: "customs.gov.kh" },
              { ref: "8", src: "World Bank — Cambodia Monitor", url: "worldbank.org/cambodia" },
              { ref: "9", src: "ADB — Cambodia Portfolio", url: "adb.org/cambodia" },
              { ref: "10", src: "IFC — Doing Business in Cambodia", url: "ifc.org" },
              { ref: "11", src: "Open Development Cambodia (ODC)", url: "opendevelopmentcambodia.net" },
              { ref: "12", src: "JETRO Cambodia Investment Survey", url: "jetro.go.jp/cambodia" },
              { ref: "13", src: "GentryLab Site Intelligence DB", url: "thegentrylab.io" },
              { ref: "14", src: "GentryLab EPC Benchmark DB", url: "thegentrylab.io" },
              { ref: "15", src: "GentryLab Permit Timeline Tracker", url: "thegentrylab.io" },
            ].map(s => (
              <div key={s.ref} style={{ display: "flex", gap: "6pt", alignItems: "baseline", borderBottom: "1pt solid #f8f8f8", paddingBottom: "3pt" }}>
                <span style={{ fontFamily: PF.head, fontSize: "6.5pt", fontWeight: 700, color: "#cc3300", minWidth: "14pt", flexShrink: 0 }}>[{s.ref}]</span>
                <div>
                  <div style={{ fontFamily: PF.head, fontSize: "7.5pt", color: "#333" }}>{s.src}</div>
                  <div style={{ fontFamily: "monospace", fontSize: "6.5pt", color: "#aaa" }}>{s.url}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ border: "1pt solid #e8e8e8", borderLeft: "3pt solid #cc3300", padding: "10pt 12pt", backgroundColor: "#fafafa", marginBottom: "18pt" }}>
          <div style={{ fontFamily: PF.head, fontSize: "7pt", fontWeight: 700, color: "#cc3300", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5pt" }}>
            Important Disclaimer
          </div>
          <div style={{ fontFamily: PF.body, fontSize: "8pt", color: "#555", lineHeight: 1.55 }}>
            This report was generated by an AI language model using the GentryLab AI Industrial Advisor platform. While every effort has been made to ensure accuracy, the information is based on publicly available data and GentryLab's proprietary benchmarks as of the date of generation. It does not constitute legal, financial, or investment advice. Regulations, tariffs, permit timelines, and market conditions in Cambodia can change rapidly. The Gentry Lab accepts no liability for decisions made in reliance on this report. Independent verification with qualified local advisors is strongly recommended before making any investment commitment.
          </div>
        </div>

        {/* Report metadata */}
        <div style={{ border: "1pt solid #eee", borderRadius: "4pt", padding: "10pt 12pt", backgroundColor: "#ffffff" }}>
          <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#999", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8pt" }}>
            Report Metadata
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4pt 24pt" }}>
            {[
              { label: "Reference", value: `#${refId}` },
              { label: "Generated", value: `${dateStr} at ${timeStr}` },
              { label: "Brief Type", value: brief.title },
              { label: "Category", value: cat.label },
              { label: "Report Type", value: reportType === "comprehensive" ? "Comprehensive Analysis" : "Standard Brief" },
              { label: "Platform", value: "GentryLab AI Industrial Advisor" },
              { label: "Jurisdiction", value: "Kingdom of Cambodia" },
              { label: "Contact", value: "advisory@thegentrylab.io" },
            ].map(m => (
              <div key={m.label} style={{ display: "flex", gap: "8pt", alignItems: "baseline", borderBottom: "1pt solid #f5f5f5", paddingBottom: "4pt" }}>
                <span style={{ fontFamily: PF.head, fontSize: "7pt", color: "#aaa", minWidth: "70pt", flexShrink: 0 }}>{m.label}</span>
                <span style={{ fontFamily: PF.body, fontSize: "8.5pt", color: "#333" }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom mark */}
        <div style={{ marginTop: "24pt", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#cc3300", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" }}>
            THE GENTRY LAB
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "6.5pt", color: "#ccc" }}>
            © {generatedAt.getFullYear()} The Gentry Lab · thegentrylab.io
          </div>
        </div>
      </div>

      {/* Running footer */}
      <div className="pr-footer">
        <div>
          <div className="pr-footer-left">
            <span className="pr-footer-brand">THE GENTRY LAB</span> · AI Industrial Advisor · Ref #{refId}
          </div>
          <div className="pr-disclaimer">
            AI-generated advisory brief. Verify all data independently. © {generatedAt.getFullYear()} The Gentry Lab 
          </div>
        </div>
        <div className="pr-footer-right">
          advisory@thegentrylab.io · thegentrylab.io
        </div>
      </div>
    </div>
  );
}

/* â─â─ Saved Briefs history component â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
function HistoryView({
  briefs, loading, onOpen, onNew,
}: {
  briefs: SavedBrief[];
  loading: boolean;
  onOpen: (b: SavedBrief) => void;
  onNew: () => void;
}) {
  const catColors: Record<string, string> = {
    INVEST: "#ff5100", DEVELOP: "#10b981", FINANCE: "#3b82f6", COMPLY: "#f59e0b", PLAN: "#8b5cf6",
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[16px] font-bold" style={{ color: "#ffffff" }}>Saved Briefs</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Reopen any brief to view, edit inputs, or regenerate</p>
        </div>
        <button onClick={onNew} className="px-4 py-2 rounded-lg font-bold text-[12px]" style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>
          + New Brief
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-12 justify-center" style={{ color: "rgba(255,255,255,0.30)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          <span className="font-mono text-[10px] uppercase tracking-widest">Loading briefs...</span>
        </div>
      )}

      {!loading && briefs.length === 0 && (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.40)" }}>No saved briefs yet.</p>
          <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Generate your first brief to see it here.</p>
          <button onClick={onNew} className="mt-5 px-5 py-2.5 rounded-lg font-bold text-[12px]" style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100", border: "1px solid rgba(255,81,0,0.25)" }}>
            Generate a Brief â†’
          </button>
        </div>
      )}

      {!loading && briefs.length > 0 && (
        <div className="space-y-2">
          {briefs.map(b => {
            const color = catColors[b.category] ?? "#ff5100";
            const date = new Date(b.created_at);
            const preview = b.output?.replace(/[#>*`|]/g, "").replace(/\n/g, " ").slice(0, 120) ?? "";
            return (
              <button key={b.id} onClick={() => onOpen(b)} className="w-full text-left p-4 rounded-xl transition-all group"
                style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${color}40`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded shrink-0" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}>
                      {b.category}
                    </span>
                    <span className="text-[13px] font-semibold truncate" style={{ color: "#ffffff" }}>{b.brief_title}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color }}>Open â†’</span>
                  </div>
                </div>
                {preview && (
                  <p className="text-[11px] mt-2 leading-relaxed line-clamp-2" style={{ color: "rgba(255,255,255,0.30)" }}>{preview}...</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* â─â─ Main page â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─ */
export default function AdvisorPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("select");
  const [category, setCategory] = useState<Category>("INVEST");
  const [selectedBrief, setSelectedBrief] = useState<BriefType | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedBriefId, setSavedBriefId] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date>(new Date());
  const [savedBriefs, setSavedBriefs] = useState<SavedBrief[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("standard");
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [creditError, setCreditError] = useState<{ balance: number } | null>(null);
  const [userNotes, setUserNotes] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [refining, setRefining] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const catBriefs = BRIEFS.filter(b => b.category === category);
  const activeCat = CATEGORIES.find(c => c.id === category)!;

  async function loadBriefs() {
    if (!user || !supabase) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("advisor_briefs")
      .select("id, brief_type, brief_title, category, fields, output, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setSavedBriefs((data as SavedBrief[]) ?? []);
    setHistoryLoading(false);
  }

  function openHistory() {
    loadBriefs();
    setStep("history");
  }

  function reopenBrief(b: SavedBrief) {
    const briefDef = BRIEFS.find(def => def.id === b.brief_type);
    if (!briefDef) return;
    setSelectedBrief(briefDef);
    setCategory(briefDef.category);
    setForm(b.fields ?? {});
    setOutput(b.output ?? "");
    setSaved(true);
    setSavedBriefId(b.id);
    setGeneratedAt(new Date(b.created_at));
    setIsEditMode(false);
    setStep("result");
  }

  function selectBrief(b: BriefType) {
    setSelectedBrief(b);
    setForm({});
    setOutput("");
    setSaved(false);
    setSavedBriefId(null);
    setIsEditMode(false);
    setChartData(null);
    setCreditError(null);
    setUserNotes("");
    setStep("form");
  }

  function editAndRegenerate() {
    setIsEditMode(true);
    setStep("form");
  }

  async function downloadAsPPT() {
    if (!selectedBrief || !output) return;
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = selectedBrief.title;
    pptx.company = "The Gentry Lab";
    const refId = savedBriefId ? savedBriefId.slice(0, 8).toUpperCase() : "DRAFT";
    const dateStr = generatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const RED = "CC3300", DARK = "111111", GRAY = "666666", LGRAY = "AAAAAA", WHITE = "FFFFFF";
    const cat = CATEGORIES.find(c => c.id === selectedBrief.category)!;

    // â─â─ Slide 1: Cover â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─
    const s1 = pptx.addSlide();
    s1.background = { color: WHITE };
    s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.07, fill: { color: RED } } as any);
    s1.addText("THE GENTRY LAB", { x: 0.6, y: 0.35, w: 12, h: 0.35, fontSize: 10, color: RED, bold: true, charSpacing: 6, fontFace: "Arial" });
    s1.addText(selectedBrief.title, { x: 0.6, y: 1.0, w: 9.5, h: 2.5, fontSize: 36, color: DARK, bold: true, fontFace: "Arial", valign: "top" });
    s1.addShape(pptx.ShapeType.rect, { x: 0.6, y: 3.7, w: 0.7, h: 0.05, fill: { color: RED } } as any);
    s1.addText(`${reportType === "comprehensive" ? "Comprehensive Analysis Report" : "Standard Advisory Brief"}  ·  ${cat.label}`, { x: 0.6, y: 3.85, w: 10, h: 0.3, fontSize: 11, color: GRAY, fontFace: "Arial" });
    s1.addText(dateStr, { x: 0.6, y: 4.2, w: 10, h: 0.3, fontSize: 11, color: LGRAY, fontFace: "Arial" });
    s1.addShape(pptx.ShapeType.rect, { x: 0, y: 7.1, w: "100%", h: 0.02, fill: { color: "EEEEEE" } } as any);
    s1.addText(`REF #${refId}  ·  AI INDUSTRIAL ADVISOR  ·  CAMBODIA`, { x: 0.6, y: 7.15, w: 9, h: 0.3, fontSize: 7, color: "BBBBBB", fontFace: "Arial" });
    s1.addText("thegentrylab.io", { x: 10.5, y: 7.15, w: 2.5, h: 0.3, fontSize: 7, color: "BBBBBB", fontFace: "Arial", align: "right" });

    // â─â─ Slide 2: Analysis Parameters â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─
    const labelMap2: Record<string, string> = {};
    selectedBrief.fields.forEach(f => { labelMap2[f.id] = f.label; });
    const inputPairs2 = Object.entries(form).filter(([, v]) => v).map(([k, v]) => ({ key: labelMap2[k] ?? k, val: v }));
    if (inputPairs2.length > 0) {
      const s2 = pptx.addSlide();
      s2.background = { color: WHITE };
      s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.07, fill: { color: RED } } as any);
      s2.addText("THE GENTRY LAB  —  Analysis Parameters", { x: 0.4, y: 0.2, w: 12, h: 0.35, fontSize: 9, color: RED, bold: true, charSpacing: 3, fontFace: "Arial" });
      s2.addText(selectedBrief.title, { x: 0.4, y: 0.55, w: 12, h: 0.35, fontSize: 14, color: DARK, bold: true, fontFace: "Arial" });
      const rows: string[][] = inputPairs2.map(p => [p.key, p.val]);
      s2.addTable([
        [{ text: "Parameter", options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 9, fontFace: "Arial" } },
         { text: "Value", options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 9, fontFace: "Arial" } }],
        ...rows.map(r => r.map(cell => ({ text: cell, options: { fontSize: 10, fontFace: "Arial" } }))),
      ], { x: 0.4, y: 1.0, w: 12.5, colW: [3.5, 9], border: { type: "solid", color: "EEEEEE" } as const });
    }

    // â─â─ Slide 3: Key Statistics Infographic â─â─â─â─â─â─â─â─â─â─â─â─â─â─
    const ssd2 = chartData?.type === "site_selection" ? chartData as SiteSelectionChartData : null;
    const gd2 = chartData?.type === "generic" ? chartData as GenericChartData : null;
    if (ssd2) {
      const s3 = pptx.addSlide();
      s3.background = { color: WHITE };
      s3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.07, fill: { color: RED } } as any);
      s3.addText("KEY MARKET INDICATORS", { x: 0.4, y: 0.15, w: 12, h: 0.35, fontSize: 9, color: RED, bold: true, charSpacing: 4, fontFace: "Arial" });
      const stats = ssd2.key_stats;
      const statItems = [
        { label: "Min. Wage", val: `$${stats.min_wage_usd}`, unit: "/ month" },
        { label: "Power Tariff", val: `$${stats.power_min}–$${stats.power_max}`, unit: "/ kWh" },
        { label: "SEZ Permits", val: `${stats.sez_permit_months} mo`, unit: "inside SEZ" },
        { label: "Outside SEZ", val: `${stats.outside_permit_months} mo`, unit: "permit time" },
      ];
      statItems.forEach((st, i) => {
        const x = 0.4 + i * 3.1;
        s3.addShape(pptx.ShapeType.rect, { x, y: 0.7, w: 2.9, h: 1.4, fill: { color: i % 2 === 0 ? "FFF8F6" : "F5F5F5" } } as any);
        s3.addShape(pptx.ShapeType.rect, { x, y: 0.7, w: 0.05, h: 1.4, fill: { color: RED } } as any);
        s3.addText(st.label, { x: x + 0.1, y: 0.75, w: 2.7, h: 0.3, fontSize: 8, color: LGRAY, fontFace: "Arial" });
        s3.addText(st.val, { x: x + 0.1, y: 1.05, w: 2.7, h: 0.6, fontSize: 22, color: RED, bold: true, fontFace: "Arial" });
        s3.addText(st.unit, { x: x + 0.1, y: 1.7, w: 2.7, h: 0.3, fontSize: 8, color: LGRAY, fontFace: "Arial" });
      });
      // Zone rankings table
      s3.addText("ZONE RANKINGS", { x: 0.4, y: 2.3, w: 12, h: 0.3, fontSize: 9, color: GRAY, bold: true, charSpacing: 3, fontFace: "Arial" });
      const zoneRows = ssd2.zones.map(z => [
        `#${z.rank}`, z.name, z.province, z.zone_type,
        String(z.score), `${z.labour}/10`, `${z.cost}/10`, `${z.permits}/10`, `${z.infrastructure}/10`,
      ]);
      s3.addTable([
        ["Rank","Zone","Province","Type","Score","Labour","Cost","Permits","Infra"].map(h => (
          { text: h, options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 8, fontFace: "Arial" } }
        )),
        ...zoneRows.map(r => r.map(cell => ({ text: cell, options: { fontSize: 9, fontFace: "Arial" } }))),
      ], { x: 0.4, y: 2.65, w: 12.5, colW: [0.6, 2.2, 1.5, 1.3, 0.7, 0.8, 0.7, 0.8, 0.7], border: { type: "solid", color: "EEEEEE" } as const });
    }

    // â─â─ Slide 4: Charts â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─
    if (ssd2) {
      const s4 = pptx.addSlide();
      s4.background = { color: WHITE };
      s4.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.07, fill: { color: RED } } as any);
      s4.addText("COST COMPARISON & TIMELINE", { x: 0.4, y: 0.15, w: 12, h: 0.35, fontSize: 9, color: RED, bold: true, charSpacing: 4, fontFace: "Arial" });
      // Cost bar chart
      const costChartData = [
        { name: "Land Lease /m²/yr ($)", labels: ssd2.costs.map(c => c.zone), values: ssd2.costs.map(c => c.land_lease_m2_yr) },
        { name: "Build Cost /m² ($)", labels: ssd2.costs.map(c => c.zone), values: ssd2.costs.map(c => c.build_cost_m2) },
      ];
      s4.addChart(pptx.ChartType.bar, costChartData.map((cd, ci) => ({
        name: cd.name,
        labels: cd.labels,
        values: cd.values,
      })), { x: 0.4, y: 0.6, w: 6, h: 3.2, chartColors: [RED, "1A5C9E", "217A4B", "7B3FA0"], showTitle: false, showLegend: true, legendPos: "b", dataLabelFormatCode: "$#,##0" });
      // Cost breakdown pie chart
      if (ssd2.cost_breakdown && ssd2.cost_breakdown.length > 0) {
        s4.addText("INVESTMENT BREAKDOWN", { x: 6.8, y: 0.5, w: 6, h: 0.3, fontSize: 9, color: GRAY, bold: true, charSpacing: 3, fontFace: "Arial" });
        s4.addChart(pptx.ChartType.pie, [{
          name: "Cost Breakdown",
          labels: ssd2.cost_breakdown.map(s => s.label),
          values: ssd2.cost_breakdown.map(s => s.value),
        }], { x: 6.8, y: 0.85, w: 6.2, h: 3.0, chartColors: [RED, "1A5C9E", "217A4B", "7B3FA0", "B86E00"], showTitle: false, showLegend: true, legendPos: "r", dataLabelPosition: "outEnd", dataLabelFormatCode: '0"%"' });
      }
      // Gantt / timeline table
      s4.addText("PROJECT TIMELINE (WEEKS)", { x: 0.4, y: 3.95, w: 12, h: 0.3, fontSize: 9, color: GRAY, bold: true, charSpacing: 3, fontFace: "Arial" });
      const tl = ssd2.timeline_weeks;
      const tlRows = [
        ["Land Due Diligence", String(tl.due_diligence)],
        ["Environmental (MoE)", String(tl.environmental)],
        ["MIH Operating Licence", String(tl.mih_licence)],
        ["CDC QIP Registration", String(tl.cdc_qip)],
        ["Construction", String(tl.construction)],
        ["Utility Connection", String(tl.utilities)],
        ["TOTAL", String(Object.values(tl).reduce((a, b) => a + b, 0))],
      ];
      s4.addTable([
        [{ text: "Phase", options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 9, fontFace: "Arial" } },
         { text: "Weeks", options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 9, fontFace: "Arial" } }],
        ...tlRows.map((r, ri) => r.map(cell => ({
          text: cell,
          options: { fontSize: 10, fontFace: "Arial", bold: ri === tlRows.length - 1, color: ri === tlRows.length - 1 ? RED : DARK },
        }))),
      ], { x: 0.4, y: 4.3, w: 5.5, colW: [4.2, 1.3], border: { type: "solid", color: "EEEEEE" } as const });
    }

    if (gd2) {
      const s3g = pptx.addSlide();
      s3g.background = { color: WHITE };
      s3g.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.07, fill: { color: RED } } as any);
      s3g.addText("KEY FIGURES & ANALYSIS", { x: 0.4, y: 0.15, w: 12, h: 0.35, fontSize: 9, color: RED, bold: true, charSpacing: 4, fontFace: "Arial" });
      // Key metrics
      gd2.key_metrics?.slice(0, 4).forEach((m, i) => {
        const x = 0.4 + i * 3.1;
        s3g.addShape(pptx.ShapeType.rect, { x, y: 0.7, w: 2.9, h: 1.4, fill: { color: i % 2 === 0 ? "FFF8F6" : "F5F5F5" } } as any);
        s3g.addText(m.label, { x: x + 0.1, y: 0.75, w: 2.7, h: 0.3, fontSize: 8, color: LGRAY, fontFace: "Arial" });
        s3g.addText(m.value, { x: x + 0.1, y: 1.05, w: 2.7, h: 0.55, fontSize: 20, color: RED, bold: true, fontFace: "Arial" });
        s3g.addText(m.unit, { x: x + 0.1, y: 1.65, w: 2.7, h: 0.3, fontSize: 8, color: LGRAY, fontFace: "Arial" });
      });
      // Pie chart
      if (gd2.pie_data && gd2.pie_data.length > 0) {
        s3g.addChart(pptx.ChartType.pie, [{
          name: "Distribution",
          labels: gd2.pie_data.map(s => s.label),
          values: gd2.pie_data.map(s => s.value),
        }], { x: 0.4, y: 2.2, w: 5.8, h: 3.5, chartColors: [RED, "1A5C9E", "217A4B", "7B3FA0", "B86E00"], showTitle: false, showLegend: true, legendPos: "r" });
      }
      // Comparison table
      if (gd2.comparison_table?.headers?.length > 0) {
        s3g.addTable([
          gd2.comparison_table.headers.map(h => ({ text: h, options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 9, fontFace: "Arial" } })),
          ...gd2.comparison_table.rows.map(r => r.map(cell => ({ text: cell, options: { fontSize: 9, fontFace: "Arial" } }))),
        ], { x: 6.5, y: 2.2, w: 7, border: { type: "solid", color: "EEEEEE" } as const });
      }
    }

    // â─â─ Content slides â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─
    const lines = output.split("\n").filter(l => l.trim());
    const LINES_PER_SLIDE = 22;
    for (let i = 0; i < lines.length; i += LINES_PER_SLIDE) {
      const chunk = lines.slice(i, i + LINES_PER_SLIDE);
      const sc = pptx.addSlide();
      sc.background = { color: WHITE };
      sc.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.07, fill: { color: RED } } as any);
      sc.addText(selectedBrief.title, { x: 0.4, y: 0.12, w: 10, h: 0.3, fontSize: 9, color: RED, bold: true, fontFace: "Arial" });
      sc.addText(`Ref #${refId}  ·  ${dateStr}`, { x: 10.5, y: 0.12, w: 2.7, h: 0.3, fontSize: 7, color: LGRAY, align: "right", fontFace: "Arial" });
      const textRuns = chunk.map(line => {
        const isH2 = line.startsWith("## ");
        const isH3 = line.startsWith("### ");
        const isBullet = line.startsWith("- ") || line.startsWith("• ");
        const clean = line.replace(/^#{1,3}\s+/, "").replace(/^[-"•]\s+/, "").replace(/\*\*(.*?)\*\*/g, "$1");
        return { text: (isBullet ? "  • " : "") + clean, options: { fontSize: isH2 ? 13 : isH3 ? 11 : 10, bold: isH2 || isH3, color: isH2 ? RED : DARK, breakLine: true, fontFace: "Arial" } };
      });
      sc.addText(textRuns, { x: 0.4, y: 0.55, w: 12.5, h: 6.8, valign: "top" });
    }

    // â─â─ Last slide: Disclaimer â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─â─
    const sLast = pptx.addSlide();
    sLast.background = { color: WHITE };
    sLast.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.07, fill: { color: RED } } as any);
    sLast.addText("DISCLAIMER & REPORT METADATA", { x: 0.4, y: 0.15, w: 12, h: 0.35, fontSize: 9, color: RED, bold: true, charSpacing: 4, fontFace: "Arial" });
    sLast.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.65, w: 12.5, h: 2.2, fill: { color: "FAFAFA" } } as any);
    sLast.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.65, w: 0.07, h: 2.2, fill: { color: RED } } as any);
    sLast.addText("This report was generated by an AI language model (Anthropic Claude) via the GentryLab AI Industrial Advisor platform. It does not constitute legal, financial, or investment advice. Regulations, tariffs, and market conditions in Cambodia change rapidly. Independent verification with qualified local advisors is strongly recommended before making any investment commitment. The Gentry Lab accepts no liability for decisions made in reliance on this report.", { x: 0.6, y: 0.7, w: 12.1, h: 2.1, fontSize: 9.5, color: GRAY, fontFace: "Arial", valign: "middle" });
    const metaItems = [
      ["Reference", `#${refId}`], ["Generated", dateStr], ["Brief", selectedBrief.title],
      ["Category", cat.label], ["Report Type", reportType === "comprehensive" ? "Comprehensive" : "Standard"],
      ["Platform", "GentryLab AI Industrial Advisor"], ["Contact", "advisory@thegentrylab.io"],
    ];
    sLast.addTable([
      [{ text: "Field", options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 9, fontFace: "Arial" } },
       { text: "Value", options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 9, fontFace: "Arial" } }],
      ...metaItems.map(r => r.map(cell => ({ text: cell, options: { fontSize: 10, fontFace: "Arial" } }))),
    ], { x: 0.4, y: 3.05, w: 8, colW: [2.5, 5.5], border: { type: "solid", color: "EEEEEE" } as const });
    sLast.addText("THE GENTRY LAB", { x: 0.4, y: 7.0, w: 6, h: 0.35, fontSize: 11, color: RED, bold: true, charSpacing: 5, fontFace: "Arial" });
    sLast.addText(`© ${generatedAt.getFullYear()} The Gentry Lab   ·  thegentrylab.io`, { x: 7, y: 7.0, w: 6, h: 0.35, fontSize: 8, color: LGRAY, align: "right", fontFace: "Arial" });

    const slug = selectedBrief.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
    await pptx.writeFile({ fileName: `GentryLab_${slug}_${refId}.pptx` });
  }

  async function generate() {
    if (!selectedBrief) return;
    setStep("generating");
    setOutput("");
    setStreaming(true);
    setSaved(false);
    setSavedBriefId(null);
    setChartData(null);
    setCreditError(null);
    const now = new Date();
    setGeneratedAt(now);

    await new Promise(r => setTimeout(r, 600));
    setStep("result");

    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;

      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ briefType: selectedBrief.id, briefTitle: selectedBrief.title, fields: form, reportType, userNotes: userNotes.trim() }),
      });

      if (res.status === 402) {
        const body = await res.json().catch(() => ({}));
        setCreditError({ balance: body.balance ?? 0 });
        setStep("form");
        setStreaming(false);
        return;
      }

      if (!res.ok || !res.body) { setOutput("[Error generating brief. Please try again.]"); setStreaming(false); return; }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += dec.decode(value, { stream: true });
        setOutput(accumulated);
      }

      // Extract chart data from comprehensive mode response
      const { chartData: parsed, cleanText } = extractChartData(accumulated);
      if (parsed) {
        setChartData(parsed);
        setOutput(cleanText);
        accumulated = cleanText;
      }

      // Auto-save to Supabase
      if (user && supabase) {
        const { data: inserted } = await supabase.from("advisor_briefs").insert({
          user_id: user.id,
          brief_type: selectedBrief.id,
          brief_title: selectedBrief.title,
          category: selectedBrief.category,
          fields: form,
          output: accumulated,
        }).select("id").single();
        if (inserted?.id) setSavedBriefId(inserted.id);
        setSaved(true);
        setIsEditMode(false);
      }
    } catch (e) {
      setOutput("[Error: " + (e instanceof Error ? e.message : "Unknown error") + "]");
    } finally {
      setStreaming(false);
    }
  }

  async function refine() {
    if (!selectedBrief || !refinePrompt.trim()) return;
    setRefining(true);
    setOutput("");
    setChartData(null);
    setCreditError(null);
    const now = new Date();
    setGeneratedAt(now);

    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;

      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          briefType: selectedBrief.id,
          briefTitle: selectedBrief.title,
          fields: form,
          reportType,
          refinePrompt: refinePrompt.trim(),
        }),
      });

      if (res.status === 402) {
        const body = await res.json().catch(() => ({}));
        setCreditError({ balance: body.balance ?? 0 });
        setRefining(false);
        return;
      }

      if (!res.ok || !res.body) { setOutput("[Error refining brief. Please try again.]"); setRefining(false); return; }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += dec.decode(value, { stream: true });
        setOutput(accumulated);
      }

      const { chartData: parsed, cleanText } = extractChartData(accumulated);
      if (parsed) { setChartData(parsed); setOutput(cleanText); accumulated = cleanText; }

      if (user && supabase) {
        const { data: inserted } = await supabase.from("advisor_briefs").insert({
          user_id: user.id, brief_type: selectedBrief.id, brief_title: selectedBrief.title,
          category: selectedBrief.category, fields: form, output: accumulated,
        }).select("id").single();
        if (inserted?.id) setSavedBriefId(inserted.id);
        setSaved(true);
      }
      setRefinePrompt("");
    } catch (e) {
      setOutput("[Error: " + (e instanceof Error ? e.message : "Unknown error") + "]");
    } finally {
      setRefining(false);
    }
  }

  function reset() {
    setStep("select");
    setSelectedBrief(null);
    setOutput("");
    setForm({});
    setSaved(false);
    setSavedBriefId(null);
    setIsEditMode(false);
    setChartData(null);
    setCreditError(null);
    setReportType("standard");
    setUserNotes("");
    setRefinePrompt("");
    setRefining(false);
  }

  const allFilled = selectedBrief?.fields.filter(f => f.required).every(f => form[f.id]?.trim());

  /* â─â─ Render â─â─ */
  return (
    <>
      {/* Print report (hidden on screen, shown on print) */}
      {selectedBrief && output && (
        <PrintReport
          brief={selectedBrief}
          form={form}
          output={output}
          savedBriefId={savedBriefId}
          generatedAt={generatedAt}
          chartData={chartData}
          reportType={reportType}
        />
      )}

      {/* Screen content */}
      <div className="advisor-screen min-h-screen" style={{ backgroundColor: "#0a0a0b", color: "#ffffff" }}>
        <TopNav />

        {/* Hero */}
        <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0d0d0e" }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-6 sm:py-10">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-[9px] uppercase tracking-[0.25em] px-2.5 py-1 rounded" style={{ color: "#ff5100", backgroundColor: "rgba(255,81,0,0.10)", border: "1px solid rgba(255,81,0,0.20)" }}>
                    AI Tool · Beta
                  </span>
                  {user && <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.25)" }}>Logged in · Credits active</span>}
                </div>
                <h1 className="text-[28px] md:text-[36px] font-extrabold tracking-tight leading-tight" style={{ color: "#ffffff" }}>
                  AI Industrial Advisor
                </h1>
                <p className="mt-2 text-[13px] leading-relaxed max-w-xl" style={{ color: "rgba(255,255,255,0.40)" }}>
                  Generate structured investment briefs — site selection, feasibility, permits, finance, and more — powered by Cambodia ground-level data.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {user && step !== "history" && (
                  <button onClick={openHistory} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest transition"
                    style={{ border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.50)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    My Briefs
                  </button>
                )}
                {step !== "select" && step !== "history" && (
                  <button onClick={reset} className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest rounded transition"
                    style={{ border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }}>
                    â† New Brief
                  </button>
                )}
                {step === "history" && (
                  <button onClick={reset} className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest rounded transition"
                    style={{ border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }}>
                    â† Back
                  </button>
                )}
              </div>
            </div>

            {/* Step indicator */}
            {step !== "history" && (
              <div className="flex items-center gap-2 mt-8">
                {(["select","form","result"] as Step[]).map((s, i) => {
                  const labels = ["Select Brief","Fill Details","Your Brief"];
                  const isActive = step === s || (step === "generating" && s === "result");
                  const isDone = (step === "form" && i === 0) || (step === "generating" && i < 2) || (step === "result" && i < 2);
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                          style={{ backgroundColor: isActive ? "#ff5100" : isDone ? "rgba(255,81,0,0.30)" : "rgba(255,255,255,0.08)", color: isActive || isDone ? "#fff" : "rgba(255,255,255,0.30)" }}>
                          {isDone ? "âœ–" : i + 1}
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-wider hidden sm:block"
                          style={{ color: isActive ? "#ff5100" : "rgba(255,255,255,0.25)" }}>{labels[i]}</span>
                      </div>
                      {i < 2 && <div className="w-8 h-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-6 sm:py-10">

          {/* â─â─ Auth gate â─â─ */}
          {!user && (
            <div className="max-w-md mx-auto text-center py-16">
              <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: "rgba(255,81,0,0.10)", border: "1px solid rgba(255,81,0,0.20)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h2 className="text-[18px] font-bold mb-2" style={{ color: "#ffffff" }}>Sign in to use the Advisor</h2>
              <p className="text-[13px] mb-6" style={{ color: "rgba(255,255,255,0.40)" }}>AI Industrial Advisor briefs require a free account.</p>
              <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px]"
                style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>
                Sign in free â†’
              </Link>
            </div>
          )}

          {/* â─â─ History â─â─ */}
          {user && step === "history" && (
            <HistoryView
              briefs={savedBriefs}
              loading={historyLoading}
              onOpen={reopenBrief}
              onNew={reset}
            />
          )}

          {/* â─â─ Step 1: Select â─â─ */}
          {user && step === "select" && (
            <div>
              <div className="flex flex-wrap gap-2 mb-8">
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setCategory(cat.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all"
                    style={{
                      backgroundColor: category === cat.id ? cat.color : "rgba(255,255,255,0.04)",
                      color: category === cat.id ? "#000" : "rgba(255,255,255,0.50)",
                      border: `1px solid ${category === cat.id ? cat.color : "rgba(255,255,255,0.08)"}`,
                      fontWeight: category === cat.id ? 700 : 400,
                    }}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>{activeCat.desc}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catBriefs.map(b => (
                  <button key={b.id} onClick={() => selectBrief(b)} className="text-left group p-5 rounded-xl transition-all"
                    style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                    onMouseEnter={e => (e.currentTarget.style.border = `1px solid ${activeCat.color}40`)}
                    onMouseLeave={e => (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.07)")}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${activeCat.color}12`, color: activeCat.color }}>{b.icon}</div>
                    <h3 className="text-[13px] font-bold mb-1.5 leading-snug" style={{ color: "#ffffff" }}>{b.title}</h3>
                    <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.40)" }}>{b.desc}</p>
                    <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: activeCat.color }}>For: {b.audience}</p>
                    <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>{b.fields.length} inputs · ~30 sec</span>
                      <span className="ml-auto font-mono text-[9px]" style={{ color: activeCat.color }}>Generate â†’</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* â─â─ Step 2: Form â─â─ */}
          {user && step === "form" && selectedBrief && (
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${activeCat.color}12`, color: activeCat.color }}>{selectedBrief.icon}</div>
                <div>
                  <h2 className="text-[16px] font-bold" style={{ color: "#ffffff" }}>{selectedBrief.title}</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {isEditMode ? "Edit your inputs and regenerate the brief" : "Fill in the details below to generate your brief"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {selectedBrief.fields.map(field => (
                  <div key={field.id}>
                    <label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.50)" }}>
                      {field.label}{field.required && <span style={{ color: "#ff5100" }}> *</span>}
                    </label>
                    {field.type === "select" ? (
                      <select value={form[field.id] ?? ""} onChange={e => setForm(p => ({ ...p, [field.id]: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg text-[12.5px] outline-none transition appearance-none"
                        style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: form[field.id] ? "#ffffff" : "rgba(255,255,255,0.30)" }}>
                        <option value="">Select...</option>
                        {field.options?.map(o => <option key={o} value={o} style={{ backgroundColor: "#1a1a1a", color: "#ffffff" }}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form[field.id] ?? ""} onChange={e => setForm(p => ({ ...p, [field.id]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2.5 rounded-lg text-[12.5px] outline-none transition"
                        style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Report type selector */}
              <div className="mt-8 rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Report Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["standard", "comprehensive"] as ReportType[]).map(rt => {
                    const isSelected = reportType === rt;
                    const cost = rt === "standard" ? CREDIT_COSTS.brief_standard : CREDIT_COSTS.brief_comprehensive;
                    return (
                      <button key={rt} onClick={() => setReportType(rt)}
                        className="text-left p-3 rounded-lg transition"
                        style={{ backgroundColor: isSelected ? "rgba(255,81,0,0.12)" : "rgba(255,255,255,0.03)", border: isSelected ? "1px solid rgba(255,81,0,0.40)" : "1px solid rgba(255,255,255,0.07)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[12px]" style={{ color: isSelected ? "#ff5100" : "rgba(255,255,255,0.75)" }}>
                            {rt === "standard" ? "Standard" : "Comprehensive"}
                          </span>
                          <span className="font-mono text-[9px]" style={{ color: isSelected ? "#ff5100" : "rgba(255,255,255,0.30)" }}>{cost} cr</span>
                        </div>
                        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {rt === "standard" ? "Structured text brief with full analysis and recommendations." : "Includes charts, cost tables, timeline visual, and scoring graphs."}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User notes */}
              <div className="mt-6 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.09)" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.50)" }}>Your notes <span style={{ color: "rgba(255,255,255,0.25)" }}>(optional)</span></p>
                </div>
                <div className="px-4 py-3">
                  <textarea
                    value={userNotes}
                    onChange={e => setUserNotes(e.target.value)}
                    placeholder="Add any specific focus areas, constraints, or context for the AI — e.g. 'Focus on garment sector', 'Budget under $5M', 'Priority is fast permit timeline'..."
                    rows={3}
                    className="w-full text-[12px] leading-relaxed outline-none resize-none transition"
                    style={{ backgroundColor: "transparent", color: "#ffffff", border: "none", padding: 0 }}
                  />
                </div>
              </div>

              {/* Credit error */}
              {creditError && (
                <div className="mt-4 rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <p className="font-bold text-[12px] mb-1" style={{ color: "#ef4444" }}>Insufficient credits</p>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.50)" }}>Your balance is {creditError.balance} cr. <Link to="/credits" className="underline" style={{ color: "#ff5100" }}>Buy more credits â†’</Link></p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-4">
                <button onClick={() => isEditMode ? setStep("result") : setStep("select")}
                  className="px-5 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest transition"
                  style={{ border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }}>
                  â† {isEditMode ? "Cancel" : "Back"}
                </button>
                <button onClick={generate} disabled={!allFilled}
                  className="flex-1 px-5 py-2.5 rounded-lg font-bold text-[13px] transition disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>
                  {isEditMode ? "Regenerate Brief â†’" : "Generate Brief â†’"}
                </button>
              </div>
              <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.20)" }}>
                {reportType === "standard" ? `${CREDIT_COSTS.brief_standard} credits` : `${CREDIT_COSTS.brief_comprehensive} credits`} · Auto-saved to your account
              </p>
            </div>
          )}

          {/* â─â─ Generating animation â─â─ */}
          {step === "generating" && (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,81,0,0.10)", border: "1px solid rgba(255,81,0,0.20)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="1.6" className="animate-spin">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="font-bold text-[14px]" style={{ color: "#ffffff" }}>Generating your brief...</p>
                <p className="font-mono text-[10px] uppercase tracking-widest mt-1" style={{ color: "rgba(255,255,255,0.30)" }}>Analysing Cambodia industrial data</p>
              </div>
            </div>
          )}

          {/* â─â─ Step 3: Result â─â─ */}
          {user && step === "result" && selectedBrief && (
            <div className="max-w-3xl">
              {/* Actions bar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${activeCat.color}12`, color: activeCat.color }}>{selectedBrief.icon}</div>
                  <h2 className="text-[14px] font-bold truncate" style={{ color: "#ffffff" }}>{selectedBrief.title}</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
                  {saved && !streaming && (
                    <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest" style={{ color: "#10b981" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Saved
                    </span>
                  )}
                  {streaming && (
                    <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.30)" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />Generating...
                    </span>
                  )}
                  {!streaming && output && (
                    <button onClick={editAndRegenerate} className="flex items-center gap-1.5 px-3 py-2 font-mono text-[9px] uppercase tracking-widest rounded transition"
                      style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.50)" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      <span className="hidden sm:inline">Edit &amp; </span>Regen
                    </button>
                  )}
                  {!streaming && output && (
                    <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 font-mono text-[9px] uppercase tracking-widest rounded transition"
                      style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.50)" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      <span className="hidden sm:inline">Print / </span>PDF
                    </button>
                  )}
                  {!streaming && output && (
                    <button onClick={downloadAsPPT} className="flex items-center gap-1.5 px-3 py-2 font-mono text-[9px] uppercase tracking-widest rounded transition"
                      style={{ border: "1px solid rgba(255,165,0,0.30)", color: "rgba(255,165,0,0.70)" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                      <span className="hidden sm:inline">Download </span>PPT
                    </button>
                  )}
                  <button onClick={reset} className="px-3 py-2 font-mono text-[9px] uppercase tracking-widest rounded transition"
                    style={{ border: "1px solid rgba(255,81,0,0.30)", color: "#ff5100" }}>
                    New Brief
                  </button>
                </div>
              </div>

              {/* Saved ref strip */}
              {savedBriefId && !streaming && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.12)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "#10b981" }}>Saved to your account</span>
                  <span className="font-mono text-[9px] ml-auto" style={{ color: "rgba(255,255,255,0.20)" }}>Ref #{savedBriefId.slice(0, 8).toUpperCase()}</span>
                  <button onClick={openHistory} className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.30)" }}>
                    View all â†’
                  </button>
                </div>
              )}

              {/* Brief output */}
              <div ref={outputRef} className="rounded-xl p-4 sm:p-6 md:p-8 min-h-[300px] sm:min-h-[400px]"
                style={{ backgroundColor: "#0d0d0e", border: "1px solid rgba(255,255,255,0.07)" }}>
                {output ? renderMarkdown(output) : (
                  <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.30)" }}>
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "120ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "240ms" }}>·</span>
                  </div>
                )}
              </div>

              {/* Comprehensive charts panel */}
              {!streaming && chartData && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "#ff5100" }}>Data Visualisation</span>
                    <span className="font-mono text-[8px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,81,0,0.10)", color: "rgba(255,81,0,0.70)", border: "1px solid rgba(255,81,0,0.20)" }}>Comprehensive</span>
                  </div>
                  {chartData.type === "site_selection" ? (
                    <>
                      <KeyStatsPanel stats={chartData.key_stats} zones={chartData.zones} />
                      <div className="grid md:grid-cols-2 gap-4">
                        <ZoneScoringChart zones={chartData.zones} />
                        <CostComparisonChart costs={chartData.costs} />
                      </div>
                      <TimelineChart timeline={chartData.timeline_weeks} />
                    </>
                  ) : (
                    <GenericChartsPanel data={chartData as GenericChartData} />
                  )}
                </div>
              )}

              {/* Refine panel */}
              {!streaming && !refining && output && (
                <div className="mt-6 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.09)" }}>
                  {/* Header */}
                  <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,81,0,0.12)", border: "1px solid rgba(255,81,0,0.25)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </div>
                    <div>
                      <p className="font-bold text-[13px]" style={{ color: "#ffffff" }}>Refine this report</p>
                      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>Tell the AI what to adjust, expand, or focus on — it will regenerate using your inputs</p>
                    </div>
                  </div>

                  {/* Prompt chips */}
                  <div className="px-5 pt-4 pb-2 flex flex-wrap gap-2">
                    {[
                      "Focus more on risk factors",
                      "Add more detail on permits",
                      "Compare costs in more depth",
                      "Summarise into executive bullets",
                      "Expand the recommended action plan",
                      "Include labour market analysis",
                    ].map(chip => (
                      <button key={chip} onClick={() => setRefinePrompt(chip)}
                        className="px-3 py-1 rounded-full text-[10.5px] transition"
                        style={{
                          backgroundColor: refinePrompt === chip ? "rgba(255,81,0,0.15)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${refinePrompt === chip ? "rgba(255,81,0,0.40)" : "rgba(255,255,255,0.10)"}`,
                          color: refinePrompt === chip ? "#ff5100" : "rgba(255,255,255,0.55)",
                        }}>
                        {chip}
                      </button>
                    ))}
                  </div>

                  {/* Text input */}
                  <div className="px-5 pb-5 pt-2">
                    <textarea
                      value={refinePrompt}
                      onChange={e => setRefinePrompt(e.target.value)}
                      placeholder="Or type your own instruction — e.g. 'Add a section on logistics corridors', 'Focus only on Sihanoukville', 'Expand the financial model'..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl text-[12px] leading-relaxed outline-none resize-none transition"
                      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                    />
                    {creditError && (
                      <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "#ef4444" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Insufficient credits ({creditError.balance} cr). <Link to="/credits" className="underline ml-1" style={{ color: "#ff5100" }}>Buy more â†’</Link>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                      <span className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.20)" }}>
                        Uses {reportType === "standard" ? "75" : "150"} credits · saves new version
                      </span>
                      <button
                        onClick={refine}
                        disabled={!refinePrompt.trim()}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[12px] transition disabled:opacity-30 disabled:cursor-not-allowed w-full sm:w-auto"
                        style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.95"/></svg>
                        <span className="hidden sm:inline">Regenerate with adjustments</span>
                        <span className="sm:hidden">Regenerate</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Refining indicator */}
              {refining && (
                <div className="mt-6 flex items-center gap-3 px-5 py-4 rounded-xl" style={{ backgroundColor: "rgba(255,81,0,0.05)", border: "1px solid rgba(255,81,0,0.15)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="1.8" className="animate-spin shrink-0"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>Regenerating with your adjustments...</span>
                </div>
              )}

              {/* Advisory CTA */}
              {!streaming && !refining && output && (
                <div className="mt-6 p-5 rounded-xl flex items-center justify-between gap-4 flex-wrap"
                  style={{ backgroundColor: "rgba(255,81,0,0.06)", border: "1px solid rgba(255,81,0,0.15)" }}>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: "#ff5100" }}>GentryLab Advisory</p>
                    <p className="text-[12.5px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                      Want a human expert to review this brief and advise on next steps?
                    </p>
                  </div>
                  <a href="mailto:advisory@thegentrylab.io?subject=AI Brief Review Request"
                    className="px-5 py-2.5 rounded-lg font-bold text-[12px] shrink-0 transition"
                    style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>
                    Get Expert Review â†’
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

