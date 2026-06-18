import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { TopNav } from "@/components/site/TopNav";
import { useCredits, CREDIT_COSTS } from "@/lib/credits";
import PptxGenJS from "pptxgenjs";
import heroBlueprintImg from "@/assets/hero-blueprint.jpg";
import principalPortraitImg from "@/assets/principal-portrait.jpg";
import { QRCodeSVG } from "qrcode.react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

export const Route = createFileRoute("/tools/advisor")({
  component: AdvisorPage,
});

/* ── Types ─────────────────────────────────────────────── */
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

/* ── Chart: Zone Scoring ─────────────────────────────────── */
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

/* ── Chart: Cost Comparison ──────────────────────────────── */
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

/* ── Chart: Timeline ─────────────────────────────────────── */
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

/* ── Chart: Key Stats ────────────────────────────────────── */
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

/* ── Generic chart panel ─────────────────────────────────── */
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

/* ── Category config ────────────────────────────────────── */
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

const SECTORS = ["Garment & Textiles","Electronics & PCB","Food Processing","Warehousing & Logistics","Automotive / EV","Data Center","Energy / Solar","Pharmaceutical","Furniture","Footwear","Agro-processing","Chemical / Plastics","Metal Fabrication","Cosmetics / Personal Care","Medical Devices"];
const PROVINCES = [
  "Phnom Penh","Kandal","Kampong Speu","Preah Sihanouk (Sihanoukville)","Svay Rieng","Kampong Cham",
  "Kampot","Siem Reap","Battambang","Banteay Meanchey","Kampong Chhnang","Kampong Thom",
  "Kep","Koh Kong","Kratié","Mondulkiri","Oddar Meanchey","Pailin","Preah Vihear",
  "Prey Veng","Pursat","Ratanakiri","Stung Treng","Takéo","Tboung Khmum",
  "Recommend best province for my needs",
];
const BUDGET_RANGES = ["Under USD 500K","USD 500K – 1M","USD 1M – 5M","USD 5M – 20M","USD 20M – 50M","USD 50M – 100M","Over USD 100M"];
const FACTORY_SIZES = ["Under 500 m²","500 – 1,000 m²","1,000 – 3,000 m²","3,000 – 10,000 m²","10,000 – 30,000 m²","30,000 – 65,000 m²","Over 65,000 m²"];
const WORKER_COUNTS = ["Under 50","50 – 200","200 – 500","500 – 1,000","1,000 – 3,000","Over 3,000"];

/* ── Brief definitions ──────────────────────────────────── */
const BRIEFS: BriefType[] = [
  /* INVEST */
  {
    id: "site-selection", category: "INVEST", title: "Site Selection Brief",
    desc: "Top 3 zone recommendations scored across 14 criteria — utilities, labour, cost, permits, risk.",
    audience: "Manufacturer evaluating Cambodia entry",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    fields: [
      { id: "sector", label: "Industry Sector", type: "select", options: SECTORS, required: true },
      { id: "factory_size", label: "Factory / Facility Size", type: "select", options: FACTORY_SIZES, required: true },
      { id: "budget", label: "Total Investment Budget", type: "select", options: BUDGET_RANGES, required: true },
      { id: "workers_needed", label: "Planned Workforce (year 1)", type: "select", options: WORKER_COUNTS, required: true },
      { id: "province_preference", label: "Province Preference", type: "select", options: PROVINCES, required: true },
      { id: "priority", label: "Top Priority Criteria", type: "select", options: ["Lowest total cost","Fastest timeline to production","Best tax incentives","Strongest labour pool","Port / export logistics access","Inside SEZ preferred","Recommend best balance"], required: true },
      { id: "inside_sez", label: "SEZ or Greenfield?", type: "select", options: ["Inside SEZ preferred","Greenfield / outside SEZ","Open to either — advise me"], required: true },
      { id: "timeline", label: "Target Timeline to Production", type: "select", options: ["Under 12 months","12 – 18 months","18 – 24 months","Over 24 months / flexible"], required: true },
      { id: "origin_country", label: "Investor Country of Origin", type: "text", placeholder: "e.g. South Korea, China, Japan", required: true },
      { id: "special_req", label: "Special Requirements", type: "text", placeholder: "e.g. clean room, cold chain, bonded warehouse, high-power (5MW+)" },
    ],
  },
  {
    id: "feasibility-snapshot", category: "INVEST", title: "Feasibility Snapshot",
    desc: "Cost breakdown, timeline to production, incentives, and go/no-go assessment for your project.",
    audience: "Investor stress-testing a specific project",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    fields: [
      { id: "sector", label: "Industry Sector", type: "select", options: SECTORS, required: true },
      { id: "production", label: "What will you produce?", type: "text", placeholder: "e.g. garment cutting & sewing, PCB assembly, EV battery packs", required: true },
      { id: "factory_size", label: "Factory / Facility Size", type: "select", options: FACTORY_SIZES, required: true },
      { id: "investment_budget", label: "Total Investment Budget (USD)", type: "select", options: BUDGET_RANGES, required: true },
      { id: "workers_planned", label: "Planned Workforce (year 1)", type: "select", options: WORKER_COUNTS, required: true },
      { id: "location", label: "Target Province", type: "select", options: PROVINCES, required: true },
      { id: "inside_sez", label: "Inside SEZ or Outside?", type: "select", options: ["Inside SEZ","Outside SEZ / greenfield","Not sure — advise me"], required: true },
      { id: "export_market", label: "Primary Export Market", type: "select", options: ["European Union (EBA)","United States (GSP)","ASEAN region","China","Japan / South Korea","Multiple markets / domestic"], required: true },
      { id: "origin_country", label: "Investor Country of Origin", type: "text", placeholder: "e.g. South Korea, Japan, China", required: true },
      { id: "biggest_concern", label: "Biggest Risk / Concern", type: "select", options: ["Cost overruns","Permit delays","Labour availability","Power supply reliability","Political / regulatory risk","Currency / FX risk","Supply chain access","Not sure"] },
    ],
  },
  {
    id: "incentive-optimizer", category: "INVEST", title: "Incentive Optimizer",
    desc: "Full breakdown of QIP tax holidays, import duty waivers, EBA/GSP access you qualify for.",
    audience: "CFO / tax counsel calculating net investment cost",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    fields: [
      { id: "sector", label: "Industry Sector", type: "select", options: SECTORS, required: true },
      { id: "origin_country", label: "Investor Country of Origin", type: "text", placeholder: "e.g. South Korea", required: true },
      { id: "investment_size", label: "Total Investment Size (USD)", type: "select", options: BUDGET_RANGES, required: true },
      { id: "province", label: "Target Province", type: "select", options: PROVINCES, required: true },
      { id: "employees_planned", label: "Cambodian Employees Planned", type: "select", options: WORKER_COUNTS, required: true },
      { id: "export_pct", label: "Export Percentage", type: "select", options: ["Over 80% export","50–80% export","20–50% export","Under 20% / domestic market"], required: true },
      { id: "project_type", label: "Project Type", type: "select", options: ["New greenfield investment","Expansion of existing facility","Relocation from another country","Joint venture with local partner","Acquisition / brownfield"], required: true },
      { id: "inside_sez", label: "SEZ or Outside?", type: "select", options: ["Inside SEZ / developer zone","Outside SEZ — greenfield","Not decided — advise me"], required: true },
    ],
  },
  {
    id: "cambodia-vs-region", category: "INVEST", title: "Cambodia vs Region",
    desc: "Side-by-side comparison of Cambodia against Vietnam, Thailand, Indonesia on cost, speed, and risk.",
    audience: "C-suite deciding where in SE Asia to invest",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    fields: [
      { id: "sector", label: "Industry Sector", type: "select", options: SECTORS, required: true },
      { id: "origin_country", label: "Your Country / HQ", type: "text", placeholder: "e.g. Japan, Germany, USA", required: true },
      { id: "compare_with", label: "Compare Cambodia Against", type: "select", options: ["Vietnam","Thailand","Indonesia","Myanmar","Bangladesh","All SE Asia (Vietnam, Thailand, Indonesia, Myanmar)"], required: true },
      { id: "investment_size", label: "Investment Scale (USD)", type: "select", options: BUDGET_RANGES, required: true },
      { id: "factory_size", label: "Factory Size", type: "select", options: FACTORY_SIZES, required: true },
      { id: "workers_planned", label: "Planned Workforce", type: "select", options: WORKER_COUNTS, required: true },
      { id: "key_concern", label: "Primary Decision Factor", type: "select", options: ["Lowest labour cost","Fastest time to production","Best export incentives (EBA/GSP)","Lowest political / regulatory risk","Strongest supply chain ecosystem","EU/US market access","Overall risk-adjusted ROI"], required: true },
      { id: "supply_chain", label: "Supply Chain Needs", type: "select", options: ["Need local raw material supply","Need bonded warehouse access","Need strong port logistics","Self-contained — import all inputs","Not a key constraint"] },
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
      { id: "utilities_nearby", label: "Nearest Utility Infrastructure", type: "select", options: ["EDC power line on/adjacent","EDC power under 5 km","EDC power 5–15 km","No grid power nearby","Water canal / river nearby","Fully off-grid"], required: true },
      { id: "flood_risk", label: "Known Flood / Drainage Issues?", type: "select", options: ["No known issues","Minor seasonal flooding","Moderate flooding history","High flood risk area","Unknown"], required: true },
      { id: "current_use", label: "Current Land Use", type: "select", options: ["Farmland / rice paddy","Scrubland / vacant","Existing low-value structure","Operating facility","Mixed use","Other"], required: true },
      { id: "development_goal", label: "Your Development Goal", type: "select", options: ["Sell the land","Lease plots to factory tenants","Build & lease a shell factory","Develop a full industrial park","Develop a Special Economic Zone (SEZ)","Develop for own company use"], required: true },
      { id: "ownership", label: "Ownership Structure", type: "select", options: ["Cambodian individual owner","Cambodian company","Joint venture (Khmer + foreign)","Foreign company (long-lease)","Not yet decided"] },
    ],
  },
  {
    id: "tenant-matching", category: "DEVELOP", title: "Tenant Matching",
    desc: "Best-fit sectors for your site, realistic lease rates, and how to position your land to attract tenants.",
    audience: "Developer with land ready to lease",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    fields: [
      { id: "province", label: "Province / Location", type: "select", options: PROVINCES, required: true },
      { id: "land_or_building", label: "What are you offering?", type: "select", options: ["Bare land only","Serviced plot (utilities to boundary)","Shell factory building","Fitted factory (ready to use)","Whole industrial park with management","Portion of existing park"], required: true },
      { id: "size", label: "Available Size", type: "text", placeholder: "e.g. 5 ha land / 8,000 m² building", required: true },
      { id: "utilities", label: "Utilities Available", type: "select", options: ["Full services — power, water, road, telecom","Power + water + road","Power + road only","Road access only","None yet — open to developer","Inside SEZ (full service)"], required: true },
      { id: "target_tenant_origin", label: "Preferred Tenant Origin", type: "select", options: ["Any nationality welcome","East Asian (China, Korea, Japan, Taiwan)","European / US investors","SE Asian investors","Cambodian domestic companies","No preference"] },
      { id: "asking_rate", label: "Target Lease Rate (USD/m²/yr)", type: "text", placeholder: "e.g. 45 or leave blank for market recommendation" },
      { id: "lease_term", label: "Lease Term Preference", type: "select", options: ["Short-term (1–3 years)","Medium-term (3–10 years)","Long-term (10–30 years)","50-year concession","Flexible / open to advice"] },
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
      { id: "target_sector", label: "Target Tenant Sector", type: "select", options: [...SECTORS, "Mixed / multi-sector","Logistics hub","Agro-industrial park"], required: true },
      { id: "development_budget", label: "Total Development Budget (USD)", type: "select", options: ["Under USD 5M","USD 5M – 20M","USD 20M – 50M","USD 50M – 150M","Over USD 150M","Unknown — advise me"], required: true },
      { id: "utilities_status", label: "Utilities Status", type: "select", options: ["EDC power line adjacent to site","EDC power available on site","Power + water both available","All utilities available at boundary","Need to develop from scratch","Has canal / river — need pump station"], required: true },
      { id: "park_type", label: "Park Type Target", type: "select", options: ["Government-registered SEZ","Private industrial park (no SEZ status)","Agro-processing cluster","Logistics / warehousing park","Mixed-use industrial estate","Tech / light industrial campus"] },
      { id: "investor_origin", label: "Developer / Investor Origin", type: "select", options: ["Cambodian developer","Korean / Japanese JV","Chinese / HK partner","Singapore / regional fund","Government / state-owned","Mixed consortium"] },
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
      { id: "export_market", label: "Target Export Market", type: "select", options: ["European Union (EBA)","United States (GSP)","United Kingdom (UK GSP)","Japan (EPA)","Canada / Australia","ASEAN (RCEP)","China","Multiple markets"], required: true },
      { id: "origin_country", label: "Investor / Company Origin Country", type: "text", placeholder: "e.g. South Korea", required: true },
      { id: "province", label: "Production Province", type: "select", options: PROVINCES, required: true },
      { id: "local_content", label: "Estimated Cambodia Value-Add %", type: "select", options: ["Under 20%","20–35%","35–50%","Over 50%","Not sure — need guidance"], required: true },
      { id: "production_process", label: "Production Process Type", type: "select", options: ["Cut, Make, Trim (CMT)","Full Package (FOB)","Assembly only","Substantial transformation","Processing / refining"] },
    ],
  },
  {
    id: "environmental-pathway", category: "COMPLY", title: "Environmental Pathway",
    desc: "ECC category, required studies, timeline, cost, and key conditions for your project.",
    audience: "Developer or consultant navigating MoE approval",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    fields: [
      { id: "project_type", label: "Project Type", type: "select", options: ["Factory (manufacturing)","Warehouse / logistics","Industrial park / SEZ","Food processing","Chemical / pharmaceutical","Energy (solar / power plant)","Cold storage","Data center","Mixed use"], required: true },
      { id: "size", label: "Project Size", type: "select", options: FACTORY_SIZES, required: true },
      { id: "province", label: "Province", type: "select", options: PROVINCES, required: true },
      { id: "near_sensitive", label: "Near Sensitive Area?", type: "select", options: ["Near river / water body (under 500m)","Near protected forest","Near national park / protected area","Near residential community (under 200m)","Near school / hospital","None of the above","Not sure — need site assessment"], required: true },
      { id: "wastewater", label: "Wastewater / Effluent Generated?", type: "select", options: ["No process wastewater","Low volume — domestic only","Industrial wastewater (light)","Industrial wastewater (heavy / chemical)","Food processing effluent","Yes — already have treatment plan"] },
      { id: "hazmat", label: "Hazardous Materials Used?", type: "select", options: ["None","Minor — cleaning chemicals only","Moderate — paints, solvents, lubricants","Significant — industrial chemicals","Flammable / explosive materials","Not sure"] },
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

/* ── Custom select dropdown (theme-aware, no native popup) ── */
function CustomSelect({ value, onChange, options, placeholder = "Select..." }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2.5 rounded-lg text-[12.5px] text-left flex items-center justify-between gap-2 outline-none transition"
        style={{ backgroundColor: "var(--adv-input-bg)", border: `1px solid ${open ? "rgba(255,81,0,0.45)" : "var(--adv-border-input)"}`, color: value ? "var(--adv-text-hi)" : "var(--adv-text-dim)" }}>
        <span className="truncate">{value || placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none", opacity: 0.5 }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-lg overflow-auto max-h-56 py-1"
          style={{ backgroundColor: "var(--adv-hero-bg)", border: "1px solid var(--adv-border-mid)", boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}>
          {options.map(o => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-[12px] transition hover:opacity-100"
              style={{ color: value === o ? "#ff5100" : "var(--adv-text-body)", backgroundColor: value === o ? "rgba(255,81,0,0.08)" : "transparent", opacity: value === o ? 1 : 0.85 }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Screen markdown renderer ────────────────────────────── */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-[15px] font-extrabold uppercase tracking-tight mt-6 mb-2" style={{ color: "#ff5100" }}>{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-[13px] font-bold uppercase tracking-tight mt-4 mb-1.5" style={{ color: "var(--adv-text-hi)" }}>{line.slice(4)}</h3>);
    } else if (line.startsWith("#### ")) {
      elements.push(<h4 key={i} className="text-[12px] font-semibold mt-3 mb-1" style={{ color: "var(--adv-text-body)" }}>{line.slice(5)}</h4>);
    } else if (line.startsWith("> ")) {
      elements.push(<div key={i} className="my-3 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed" style={{ backgroundColor: "rgba(255,81,0,0.08)", borderLeft: "3px solid #ff5100", color: "var(--adv-text-body)" }}>{inlineMd(line.slice(2))}</div>);
    } else if (line.startsWith("⚠️")) {
      elements.push(<div key={i} className="my-3 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed" style={{ backgroundColor: "rgba(245,158,11,0.08)", borderLeft: "3px solid #f59e0b", color: "var(--adv-text-body)" }}>{inlineMd(line)}</div>);
    } else if (line.startsWith("✅")) {
      elements.push(<div key={i} className="my-3 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed" style={{ backgroundColor: "rgba(16,185,129,0.08)", borderLeft: "3px solid #10b981", color: "var(--adv-text-body)" }}>{inlineMd(line)}</div>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<div key={i} className="flex gap-2 text-[12.5px] my-0.5" style={{ color: "var(--adv-text-body)" }}><span style={{ color: "#ff5100" }} className="shrink-0 mt-0.5">·</span><span>{inlineMd(line.slice(2))}</span></div>);
    } else if (/^\d+\./.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(<div key={i} className="flex gap-2.5 text-[12.5px] my-1" style={{ color: "var(--adv-text-body)" }}><span className="font-mono text-[10px] font-bold shrink-0 mt-0.5 w-4" style={{ color: "#ff5100" }}>{num}.</span><span>{inlineMd(line.replace(/^\d+\.\s*/, ""))}</span></div>);
    } else if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) { tableLines.push(lines[i]); i++; }
      elements.push(<ScreenTable key={`t-${i}`} rows={tableLines} />);
      continue;
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="my-4" style={{ borderColor: "var(--adv-border)" }} />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(<p key={i} className="text-[12.5px] leading-relaxed my-1" style={{ color: "var(--adv-text-body)" }}>{inlineMd(line)}</p>);
    }
    i++;
  }
  return elements;
}

function inlineMd(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} style={{ color: "var(--adv-text-hi)" }}>{p.slice(2, -2)}</strong>;
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
          <tr key={ri} style={{ borderBottom: "1px solid var(--adv-border-sub)" }}>
            {row.map((cell, ci) => <td key={ci} className="py-2 px-3" style={{ color: "var(--adv-text-body)" }}>{inlineMd(cell)}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/* ── Print markdown renderer ─────────────────────────────── */
/* ── Chart data parsing from AI output text ── */
interface PChartRow { label: string; score: number; max: number }
interface ParsedChartSpec { title: string; rows: PChartRow[] }

function parsePrintCharts(text: string): ParsedChartSpec[] {
  const charts: ParsedChartSpec[] = [];
  const lines = text.split('\n');
  let lastHeading = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{1,4}\s/.test(line)) {
      const raw = line.replace(/^#{1,4}\s+/, '');
      const parsed = stripSectionEmoji(raw);
      lastHeading = parsed ? parsed.clean : raw;
    }
    if (line.startsWith('|') && !line.match(/^[\|\s\-:]+$/)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) { tableLines.push(lines[i]); i++; }
      const allRows = tableLines.map(r => r.split('|').map(c => c.trim()).filter(Boolean));
      const dataRows = allRows.filter((_, idx) => idx >= 2);
      const rows: PChartRow[] = [];
      for (const row of dataRows) {
        if (!row[0] || !row[1]) continue;
        const label = row[0].replace(/\*\*/g, '').trim().slice(0, 40);
        const val = row[1].replace(/\*\*/g, '').trim();
        const frac = val.match(/^([0-9.]+)\s*\/\s*([0-9.]+)/);
        if (frac) { rows.push({ label, score: parseFloat(frac[1]), max: parseFloat(frac[2]) }); continue; }
        const pct = val.match(/^([0-9.]+)\s*%/);
        if (pct && parseFloat(pct[1]) <= 100) { rows.push({ label, score: parseFloat(pct[1]), max: 100 }); }
      }
      if (rows.length >= 3) {
        charts.push({ title: lastHeading || 'Key Metrics', rows });
        lastHeading = '';
      }
      continue;
    }
    i++;
  }
  return charts;
}

function extractPrintKeyStats(text: string): { value: string; label: string }[] {
  const stats: { value: string; label: string }[] = [];
  const patterns: [RegExp, (m: RegExpMatchArray) => { value: string; label: string }][] = [
    [/(?:composite|overall|bankability)\s+score[:\s]+([0-9.]+)\s*\/\s*([0-9.]+)/i,
      m => ({ value: `${m[1]}/${m[2]}`, label: 'Overall Score' })],
    [/(?:total project cost|project cost|total cost)[:\s]+USD\s*([\d,]+(?:\.\d+)?(?:\s*[KMB])?)/i,
      m => ({ value: `USD ${m[1]}`, label: 'Project Value' })],
    [/(?:maximum lendable|max loan|loan amount)[^\n]*?USD\s*([\d,]+(?:,\d{3})*)/i,
      m => ({ value: `USD ${m[1]}`, label: 'Max Lendable' })],
    [/(?:land area|site area|total area)[:\s]+([\d,]+\s*(?:ha|hectares?|m²|sqm|acres?))/i,
      m => ({ value: m[1], label: 'Site Area' })],
    [/(?:labour|labor)\s+pool[:\s]+([\d,]+\+?)/i,
      m => ({ value: m[1], label: 'Labour Pool' })],
    [/([0-9.]+)\s*%\s+(?:p\.a\.|per annum|annual|growth)/i,
      m => ({ value: `${m[1]}%`, label: 'Growth Rate' })],
    [/(?:minimum wage|wage)[:\s]+USD\s*([\d,]+)/i,
      m => ({ value: `USD ${m[1]}`, label: 'Min. Wage /mo' })],
    [/(?:tax holiday|tax exemption)[^0-9]*([0-9]+)\s*(?:year|yr)/i,
      m => ({ value: `${m[1]} yr`, label: 'Tax Holiday' })],
  ];
  for (const [re, fn] of patterns) {
    const m = text.match(re);
    if (m) { const s = fn(m); if (!stats.find(x => x.label === s.label)) stats.push(s); }
  }
  return stats.slice(0, 6);
}

function SvgParsedBarChart({ title, rows, catColor }: { title: string; rows: PChartRow[]; catColor: string }) {
  const rowH = 26;
  const labelW = 155;
  const barMaxW = 310;
  const totalH = rows.length * rowH + 24;
  const barColor = (s: number, m: number) => {
    const p = s / m;
    return p >= 0.7 ? "#217a4b" : p >= 0.4 ? catColor : "#cc3300";
  };
  return (
    <div style={{ marginBottom: "16pt", breakInside: "avoid" }}>
      <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8pt", borderLeft: `3pt solid ${catColor}`, paddingLeft: "6pt" }}>{title}</div>
      <svg width="100%" viewBox={`0 0 ${labelW + barMaxW + 60} ${totalH}`} style={{ display: "block" }}>
        {rows.map((row, i) => {
          const barW = Math.max(4, Math.round((row.score / row.max) * barMaxW));
          const y = 10 + i * rowH;
          const col = barColor(row.score, row.max);
          const suffix = row.max === 100 ? "%" : `/${row.max}`;
          const short = row.label.length > 24 ? row.label.slice(0, 24) + '…' : row.label;
          return (
            <g key={i}>
              <text x="0" y={y + 10} style={{ fontFamily: PF.body, fontSize: "8pt", fill: "#444" }}>{short}</text>
              <rect x={labelW} y={y} width={barMaxW} height="16" fill="#f0f0f0" rx="3" />
              <rect x={labelW} y={y} width={barW} height="16" fill={col} rx="3" opacity="0.9" />
              <text x={labelW + barW + 6} y={y + 11} style={{ fontFamily: PF.head, fontSize: "8.5pt", fontWeight: "bold", fill: col }}>
                {row.score}{suffix}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PrintFallbackViz({ output, catColor }: { output: string; catColor: string }) {
  const charts = parsePrintCharts(output);
  const stats = extractPrintKeyStats(output);
  return (
    <>
      {stats.length > 0 && (
        <div className="pr-stat-grid" style={{ marginBottom: "18pt" }}>
          {stats.map((s, idx) => (
            <div key={idx} className="pr-stat-cell">
              <div className="pr-stat-value" style={{ color: catColor, fontSize: "18pt" }}>{s.value}</div>
              <div className="pr-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}
      {charts.map((c, idx) => <SvgParsedBarChart key={idx} title={c.title} rows={c.rows} catColor={catColor} />)}
      {charts.length === 0 && stats.length === 0 && (
        <p className="pr-p" style={{ color: "#999", fontStyle: "italic" }}>
          Structured chart data will appear here for site selection and industrial park briefs. See the Analysis &amp; Findings section for the full advisory report.
        </p>
      )}
    </>
  );
}

/* ── Category-specific analysis images ── */
const CAT_ANALYSIS_IMAGES: Record<string, string> = {
  industrial_park: "https://images.unsplash.com/photo-1565598993988-b70c0e16f5b3?w=1400&h=500&fit=crop&auto=format&q=80",
  food_processing: "https://images.unsplash.com/photo-1565598993988-b70c0e16f5b3?w=1400&h=500&fit=crop&auto=format&q=80",
  epc: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&h=500&fit=crop&auto=format&q=80",
  finance: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1400&h=500&fit=crop&auto=format&q=80",
  garment: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400&h=500&fit=crop&auto=format&q=80",
  logistics: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1400&h=500&fit=crop&auto=format&q=80",
  environmental: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1400&h=500&fit=crop&auto=format&q=80",
  energy: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=1400&h=500&fit=crop&auto=format&q=80",
};

function renderPrintMarkdown(text: string, accentColor = "#cc3300") {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const badge = (emoji: string, color: string) => (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "26pt", height: "26pt", borderRadius: "7pt", flexShrink: 0, backgroundColor: `${color}1c`, marginRight: "10pt" }}>
        <PrintIconSvg emoji={emoji} color={color} />
      </span>
    );
    if (line.startsWith("## ")) {
      const parsed = stripSectionEmoji(line.slice(3));
      elements.push(
        <div key={i} className="pr-h2" style={{ display: "flex", alignItems: "center" }}>
          {parsed ? <>{badge(parsed.emoji, accentColor)}{parsed.clean}</> : line.slice(3)}
        </div>
      );
    } else if (line.startsWith("### ")) {
      const parsed = stripSectionEmoji(line.slice(4));
      elements.push(
        <div key={i} className="pr-h3" style={{ display: "flex", alignItems: "center" }}>
          {parsed ? <>{badge(parsed.emoji, accentColor)}{parsed.clean}</> : line.slice(4)}
        </div>
      );
    } else if (line.startsWith("#### ")) {
      const parsed = stripSectionEmoji(line.slice(5));
      elements.push(
        <div key={i} className="pr-h4" style={{ display: "flex", alignItems: "center" }}>
          {parsed ? <>{badge(parsed.emoji, accentColor)}{parsed.clean}</> : line.slice(5)}
        </div>
      );
    } else if (line.startsWith("> ")) {
      elements.push(<div key={i} className="pr-blockquote">{printInline(line.slice(2))}</div>);
    } else if (line.startsWith("⚠️")) {
      const content = line.slice("⚠️".length).trimStart();
      elements.push(
        <div key={i} className="pr-warn" style={{ display: "flex", alignItems: "flex-start", gap: "10pt" }}>
          {badge("⚠️", "#b86e00")}
          <span style={{ paddingTop: "5pt" }}>{printInline(content)}</span>
        </div>
      );
    } else if (line.startsWith("✅")) {
      const content = line.slice("✅".length).trimStart();
      elements.push(
        <div key={i} className="pr-good" style={{ display: "flex", alignItems: "flex-start", gap: "10pt" }}>
          {badge("✅", "#217a4b")}
          <span style={{ paddingTop: "5pt" }}>{printInline(content)}</span>
        </div>
      );
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

/* ── SVG Print Charts ────────────────────────────────────── */
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

/* ── SVG Pie Chart ──────────────────────────────────────── */
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

/* ── SVG Cambodia Province Map ──────────────────────────── */
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

/* ── SVG Labour Pool Bar Chart ──────────────────────────── */
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

/* ── Print Report component ─────────────────────────────── */

/* TGL G-mark inline SVG — exact logo geometry, used in print header */
function TGLMark({ size = 16, color = "#cc3300" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
      <g transform="translate(2 2) scale(0.01233)">
        <rect x="143" y="2"    width="1285" height="283" fill={color}/>
        <rect x="0"   y="143"  width="287"  height="857" fill={color}/>
        <circle cx="143" cy="143" r="143"               fill={color}/>
        <rect x="558" y="572"  width="870"  height="288" fill={color}/>
        <rect x="1141" y="572" width="287"  height="890" fill={color}/>
        <rect x="0"   y="1146" width="1428" height="316" fill={color}/>
      </g>
    </svg>
  );
}

function PRHeader({ title, refId, dateStr }: { title: string; refId: string; dateStr: string }) {
  return (
    <header className="pr-running-header">
      <div className="pr-rh-logo">
        <TGLMark size={14} color="#cc3300" />
        THE GENTRY LAB<span>AI Industrial Advisor</span>
      </div>
      <div className="pr-rh-title">{title} · Ref #{refId} · {dateStr}</div>
    </header>
  );
}

function PRFooter({ pageNum, refId, year }: { pageNum: number; refId: string; year: number }) {
  return (
    <footer className="pr-running-footer">
      <div className="pr-rf-left">© {year} The Gentry Lab · advisory@thegentrylab.io</div>
      <div className="pr-rf-page">{pageNum}</div>
      <div className="pr-rf-right">Ref #{refId} · AI-generated advisory. Verify independently.</div>
    </footer>
  );
}

function ContentPage({ title, refId, dateStr, pageNum, year, children, extraClass = "", bottomAlign = false }: {
  title: string; refId: string; dateStr: string; pageNum: number; year: number;
  children: React.ReactNode; extraClass?: string; bottomAlign?: boolean;
}) {
  return (
    <table className={`pr-cpage-table pr-page-break${extraClass ? " " + extraClass : ""}`}
      style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
      <thead className="pr-cpage-thead">
        <tr><td style={{ padding: 0 }}><PRHeader title={title} refId={refId} dateStr={dateStr} /></td></tr>
      </thead>
      <tfoot className="pr-cpage-tfoot">
        <tr><td style={{ padding: 0 }}><PRFooter pageNum={pageNum} refId={refId} year={year} /></td></tr>
      </tfoot>
      <tbody className="pr-cpage-tbody">
        <tr>
          <td className="pr-content-body" style={{ verticalAlign: bottomAlign ? "bottom" : "top" }}>
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/* ── Province → satellite bbox [minLng, minLat, maxLng, maxLat] ── */
const PROVINCE_BBOX: Record<string, [number, number, number, number]> = {
  "Phnom Penh":                     [104.82, 11.48, 104.99, 11.62],
  "Kandal":                         [104.85, 11.18, 105.10, 11.38],
  "Kampong Speu":                   [104.43, 11.35, 104.63, 11.55],
  "Preah Sihanouk (Sihanoukville)": [103.44, 10.55, 103.63, 10.70],
  "Svay Rieng":                     [105.74, 11.04, 105.88, 11.14],
  "Kampong Cham":                   [105.43, 11.94, 105.55, 12.02],
  "Kampot":                         [104.15, 10.56, 104.22, 10.65],
  "Siem Reap":                      [103.80, 13.32, 103.92, 13.42],
  "Battambang":                     [102.97, 13.07, 103.12, 13.17],
  "Banteay Meanchey":               [102.95, 13.62, 103.12, 13.80],
  "Kampong Chhnang":                [104.62, 12.22, 104.72, 12.32],
  "Kampong Thom":                   [104.82, 12.65, 104.97, 12.78],
  "Kep":                            [104.28, 10.47, 104.36, 10.54],
  "Koh Kong":                       [103.41, 11.58, 103.55, 11.72],
  "Kratié":                         [106.00, 12.44, 106.12, 12.54],
  "Mondulkiri":                     [107.07, 12.41, 107.22, 12.58],
  "Oddar Meanchey":                 [103.68, 14.12, 103.88, 14.30],
  "Pailin":                         [102.54, 12.80, 102.67, 12.90],
  "Preah Vihear":                   [104.93, 13.77, 105.12, 13.95],
  "Prey Veng":                      [105.28, 11.37, 105.48, 11.52],
  "Pursat":                         [103.82, 12.50, 103.98, 12.62],
  "Ratanakiri":                     [106.93, 13.70, 107.12, 13.88],
  "Stung Treng":                    [105.96, 13.51, 106.12, 13.65],
  "Takéo":                          [104.73, 10.93, 104.87, 11.05],
  "Tboung Khmum":                   [105.62, 11.88, 105.78, 12.02],
};

function getCoverImageUrl(form: Record<string, string>): string {
  const province = form.province_preference || form.location || form.province || form.target_province || "";
  const bbox = PROVINCE_BBOX[province] ?? [102.5, 10.4, 107.9, 14.7];
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLng},${minLat},${maxLng},${maxLat}&bboxSR=4326&size=1400,700&imageSR=4326&format=jpg&f=image`;
}

/* ── SVG icons for print section headings ── */
const SECTION_EMOJI_LIST = ["📋","🏆","📍","💰","⏱️","👷","🔌","🎯","⚠️","✅","📊","📈","🏗️","🌿","⚡","🔒","🛣️","🔍","📌","🗺️","💼","🤝","📐","📉","🔧","⚙️","🧩","📏","🌐","🏭","🏢","🛑","💡","📦","🔐","🚧"];

function stripSectionEmoji(text: string): { emoji: string; clean: string } | null {
  for (const e of SECTION_EMOJI_LIST) {
    if (text.startsWith(e)) return { emoji: e, clean: text.slice(e.length).trimStart() };
  }
  return null;
}

function PrintIconSvg({ emoji, color }: { emoji: string; color: string }) {
  const p: React.SVGProps<SVGSVGElement> = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (emoji) {
    case "📋": return <svg {...p}><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>;
    case "📊": case "📈": case "📉": return <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case "💰": return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
    case "⏱️": return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "👷": return <svg {...p}><path d="M12 2a10 10 0 0 1 10 10"/><path d="M2 12A10 10 0 0 1 12 2"/><rect x="7" y="13" width="10" height="9" rx="2"/><line x1="7" y1="13" x2="17" y2="13"/></svg>;
    case "🔌": case "⚡": return <svg {...p}><polyline points="13 2 13 9 19 9 11 22 11 15 5 15 13 2"/></svg>;
    case "🎯": return <svg {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
    case "⚠️": case "🛑": return <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "✅": return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case "📍": case "📌": case "🗺️": return <svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case "🏆": return <svg {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>;
    case "🏗️": case "🏭": case "🏢": return <svg {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case "🌿": return <svg {...p}><path d="M20 2H4v20l8-4 8 4V2z"/></svg>;
    case "🔒": case "🔐": return <svg {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case "🛣️": return <svg {...p}><path d="M12 22V2M5 12H2M22 12h-3"/><circle cx="12" cy="12" r="4"/></svg>;
    case "🔍": return <svg {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case "💼": return <svg {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case "🤝": return <svg {...p}><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>;
    case "📐": case "📏": return <svg {...p}><polygon points="2 22 22 2 22 22 2 22"/><line x1="12" y1="12" x2="22" y2="12"/></svg>;
    case "🔧": case "⚙️": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>;
    case "🧩": return <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
    case "🌐": return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
    case "📦": return <svg {...p}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
    case "💡": return <svg {...p}><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>;
    case "🚧": return <svg {...p}><path d="M5 3L3 6v14h18V6l-2-3H5z"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    default: return null;
  }
}

function PrintReport({
  brief, form, output, savedBriefId, generatedAt, chartData, reportType, user,
}: {
  brief: BriefType; form: Record<string, string>; output: string;
  savedBriefId: string | null; generatedAt: Date;
  chartData: ChartData | null; reportType: ReportType;
  user: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null;
}) {
  const cat = CATEGORIES.find(c => c.id === brief.category)!;
  const refId = savedBriefId ? savedBriefId.slice(0, 8).toUpperCase() : "DRAFT";
  const dateStr = generatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = generatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const year = generatedAt.getFullYear();
  const reportUrl = savedBriefId
    ? `https://thegentrylab.io/tools/advisor`
    : "https://thegentrylab.io";
  const exportedBy = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Anonymous";
  const exportedEmail = user?.email || "—";
  const exportedId = user?.email ? user.email.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase() : "GUEST";
  const coverImageUrl = getCoverImageUrl(form);
  const analysisImageUrl = CAT_ANALYSIS_IMAGES[brief.category] ?? coverImageUrl;

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

  const catColor = cat.id === "INVEST" ? "#ff5100"
    : cat.id === "DEVELOP" ? "#10b981"
    : cat.id === "FINANCE" ? "#3b82f6"
    : cat.id === "COMPLY"  ? "#f59e0b"
    : "#8b5cf6";

  const tocItems = [
    { num: "I",   title: "Acknowledgements", page: 3 },
    { num: "II",  title: "Foreword", page: 4 },
    { num: "III", title: "Acronyms & Abbreviations", page: 5 },
    { num: "IV",  title: "Executive Summary", page: 6 },
    { num: "V",   title: "Data Visualisations", page: 7 },
    { num: "VI",  title: "Analysis & Findings", page: 9 },
    { num: "VII", title: "Conclusion", page: 11 },
    { num: "VIII",title: "References & Data Sources", page: 12 },
  ];

  const acronyms = [
    { key: "ADB",   val: "Asian Development Bank" },
    { key: "CDC",   val: "Council for the Development of Cambodia" },
    { key: "CAPEX", val: "Capital Expenditure" },
    { key: "EIA",   val: "Environmental Impact Assessment" },
    { key: "EPC",   val: "Engineering, Procurement and Construction" },
    { key: "EDC",   val: "Electricité du Cambodge" },
    { key: "FDI",   val: "Foreign Direct Investment" },
    { key: "GDCE",  val: "General Department of Customs and Excise" },
    { key: "IFC",   val: "International Finance Corporation" },
    { key: "JETRO", val: "Japan External Trade Organization" },
    { key: "LMAP",  val: "Land Management and Administration Project" },
    { key: "MIH",   val: "Ministry of Industry and Handicraft" },
    { key: "MoE",   val: "Ministry of Environment" },
    { key: "MoLVT", val: "Ministry of Labour and Vocational Training" },
    { key: "MOWRAM",val: "Ministry of Water Resources and Meteorology" },
    { key: "ODC",   val: "Open Development Cambodia" },
    { key: "OPEX",  val: "Operating Expenditure" },
    { key: "QIP",   val: "Qualified Investment Project" },
    { key: "SEZ",   val: "Special Economic Zone" },
    { key: "SEZB",  val: "Special Economic Zone Board of Cambodia" },
    { key: "TGL",   val: "The Gentry Lab" },
    { key: "WB",    val: "World Bank" },
  ];

  const references = [
    { ref: "1",  src: "Council for the Development of Cambodia (CDC). QIP Investment Registry. Phnom Penh: CDC, 2024.", url: "cdc.gov.kh" },
    { ref: "2",  src: "Special Economic Zone Board (SEZB). Directory of Special Economic Zones. Phnom Penh: SEZB, 2024.", url: "sezb.gov.kh" },
    { ref: "3",  src: "Ministry of Industry and Handicraft (MIH). Industrial Development Policy 2015–2025. Phnom Penh: MIH.", url: "mih.gov.kh" },
    { ref: "4",  src: "Ministry of Environment (MoE). Environmental Compliance Procedures Manual. Phnom Penh: MoE, 2023.", url: "moe.gov.kh" },
    { ref: "5",  src: "Electricité du Cambodge (EDC). Industrial Tariff Schedule and Grid Expansion Plan. Phnom Penh: EDC, 2024.", url: "edc.com.kh" },
    { ref: "6",  src: "Ministry of Labour and Vocational Training (MoLVT). Minimum Wage Prakas No. 429. Phnom Penh: MoLVT, 2024.", url: "molvt.gov.kh" },
    { ref: "7",  src: "General Department of Customs and Excise (GDCE). HS Tariff Schedule — Kingdom of Cambodia. Phnom Penh: GDCE, 2024.", url: "customs.gov.kh" },
    { ref: "8",  src: "World Bank Group. Cambodia Economic Update: Sustaining Growth Amid Global Headwinds. Washington, DC: World Bank, 2024.", url: "worldbank.org/cambodia" },
    { ref: "9",  src: "Asian Development Bank (ADB). ADB Cambodia Country Portfolio and Pipeline. Manila: ADB, 2024.", url: "adb.org/cambodia" },
    { ref: "10", src: "International Finance Corporation (IFC). Doing Business in Cambodia — Advisory Note. Washington, DC: IFC, 2023.", url: "ifc.org" },
    { ref: "11", src: "Open Development Cambodia (ODC). Industrial Land & SEZ Spatial Database. Phnom Penh: ODC, 2024.", url: "opendevelopmentcambodia.net" },
    { ref: "12", src: "Japan External Trade Organization (JETRO). Survey on Business Conditions of Japanese Companies in Asia — Cambodia Report. Tokyo: JETRO, 2024.", url: "jetro.go.jp/cambodia" },
    { ref: "13", src: "The Gentry Lab. Site Intelligence Database — Cambodia Industrial Sites (Proprietary). Phnom Penh: TGL, 2024.", url: "thegentrylab.io" },
    { ref: "14", src: "The Gentry Lab. EPC Benchmark Database — Cambodian Industrial Construction (Proprietary). Phnom Penh: TGL, 2024.", url: "thegentrylab.io" },
    { ref: "15", src: "The Gentry Lab. Permit Timeline Tracker — Ministry Approval Sequences Cambodia (Proprietary). Phnom Penh: TGL, 2024.", url: "thegentrylab.io" },
  ];

  return (
    <div className="advisor-print pr-root" style={{ backgroundColor: "#ffffff", color: "#000000" }}>

      {/* ══════════════════════════════════════════════
          PAGE 1 — FULL-BLEED HERO COVER (World Bank style)
      ══════════════════════════════════════════════ */}
      <div style={{ position: "relative", width: "210mm", height: "297mm", overflow: "hidden", pageBreakAfter: "always", display: "flex", flexDirection: "column", backgroundColor: "#0d1117" }}>

        {/* Hero image — full bleed satellite or blueprint fallback */}
        <img src={coverImageUrl} alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: 0.55 }}
          onError={(e) => { (e.target as HTMLImageElement).src = heroBlueprintImg; }}
        />

        {/* Dark gradient overlay — bottom-heavy like WB */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.72) 75%, rgba(0,0,0,0.92) 100%)" }} />

        {/* Top strip — category colour */}
        <div style={{ position: "relative", zIndex: 2, height: "5pt", backgroundColor: catColor, flexShrink: 0 }} />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Cover text block — bottom quarter */}
        <div style={{ position: "relative", zIndex: 2, padding: "0 16mm 14mm", flexShrink: 0 }}>

          {/* Category badge */}
          <div style={{ display: "inline-block", backgroundColor: catColor, color: "#fff", fontFamily: PF.head, fontSize: "6.5pt", fontWeight: 800, letterSpacing: "0.28em", textTransform: "uppercase", padding: "2pt 8pt", marginBottom: "10pt" }}>
            {cat.label}
          </div>

          {/* Report type */}
          <div style={{ fontFamily: PF.head, fontSize: "8pt", color: "rgba(255,255,255,0.65)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "8pt" }}>
            {reportType === "comprehensive" ? "Comprehensive Analysis Report" : "Standard Advisory Brief"}
          </div>

          {/* Main title */}
          <div style={{ fontFamily: PF.head, fontSize: "28pt", fontWeight: 900, color: "#ffffff", lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "10pt", maxWidth: "370pt" }}>
            {brief.title}
          </div>

          {/* Sub line */}
          <div style={{ fontFamily: PF.head, fontSize: "9pt", color: "rgba(255,255,255,0.7)", marginBottom: "18pt", lineHeight: 1.4 }}>
            {brief.audience} · Kingdom of Cambodia · {dateStr}
          </div>

          {/* Divider rule */}
          <div style={{ width: "100%", height: "0.75pt", backgroundColor: "rgba(255,255,255,0.2)", marginBottom: "16pt" }} />

          {/* Bottom branding — like "World Bank Group" */}
          <div style={{ display: "flex", alignItems: "center", gap: "12pt" }}>
            <TGLMark size={28} color="#ff5100" />
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "9pt", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffffff" }}>
                THE GENTRY LAB
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "6.5pt", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginTop: "2pt" }}>
                thegentrylab.io · AI Industrial Advisor · Ref #{refId}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 2 — CATEGORY COLOUR SPLASH
      ══════════════════════════════════════════════ */}
      <div style={{ width: "210mm", height: "297mm", backgroundColor: catColor, pageBreakAfter: "always", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", padding: "0 18mm", position: "relative", overflow: "hidden" }}>

        {/* Background circle decoration */}
        <div style={{ position: "absolute", right: "-80pt", top: "-80pt", width: "320pt", height: "320pt", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", right: "20pt", bottom: "-40pt", width: "180pt", height: "180pt", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.04)" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: PF.head, fontSize: "8pt", fontWeight: 700, letterSpacing: "0.4em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: "16pt" }}>
            Advisory Category
          </div>
          <div style={{ fontFamily: PF.head, fontSize: "52pt", fontWeight: 900, color: "#ffffff", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: "14pt" }}>
            {cat.label}
          </div>
          <div style={{ width: "48pt", height: "3pt", backgroundColor: "rgba(255,255,255,0.5)", marginBottom: "18pt" }} />
          <div style={{ fontFamily: PF.head, fontSize: "12pt", color: "rgba(255,255,255,0.75)", maxWidth: "280pt", lineHeight: 1.5 }}>
            {brief.title}
          </div>
          <div style={{ marginTop: "28pt", fontFamily: PF.head, fontSize: "8pt", color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}>
            THE GENTRY LAB · {dateStr}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 3 — ACKNOWLEDGEMENTS
      ══════════════════════════════════════════════ */}
      <ContentPage title={brief.title} refId={refId} dateStr={dateStr} pageNum={3} year={year} bottomAlign>
        <div className="pr-section-number">Section I</div>
        <div className="pr-h1">Acknowledgements</div>

        {/* Section photo */}
        <div className="pr-figure" style={{ marginBottom: "12pt" }}>
          <img src={heroBlueprintImg} alt="Industrial development, Cambodia"
            style={{ width: "100%", height: "100pt", objectFit: "cover", objectPosition: "center 60%", display: "block" }} />
          <div className="pr-figure-caption">
            <strong>Figure I.1</strong> — Industrial development corridor, Kingdom of Cambodia. Source: TheGentryLab.io
          </div>
        </div>

        <p className="pr-p">
          This report was produced using the GentryLab AI Industrial Advisor — a proprietary intelligence platform developed by The Gentry Lab to support foreign investors, development finance institutions, and government agencies engaged in industrial development across the Kingdom of Cambodia.
        </p>
        <p className="pr-p">
          The analysis draws upon data compiled from official Cambodian government sources, multilateral development institution publications, and The Gentry Lab's proprietary site intelligence and EPC benchmarking databases. The Gentry Lab acknowledges the role of Cambodia's Council for the Development of Cambodia (CDC), the Special Economic Zone Board (SEZB), the Ministry of Industry and Handicraft (MIH), and the Ministry of Environment (MoE) in making foundational regulatory and investment data publicly available.
        </p>
        <p className="pr-p">
          We recognise the contributions of the World Bank Group, the Asian Development Bank (ADB), the International Finance Corporation (IFC), and Open Development Cambodia (ODC) whose published research and open data platforms inform the analytical framework applied in this report.
        </p>
        <p className="pr-p">
          The Gentry Lab extends appreciation to the investors, developers, and operators whose field experience and ground-level insights have calibrated our benchmarking models over more than 60 delivered industrial development engagements in Southeast Asia.
        </p>

        {/* Parameters strip */}
        {inputPairs.length > 0 && (
          <div style={{ marginTop: "20pt", padding: "12pt 14pt", backgroundColor: "#f8f8f8", borderTop: `3pt solid ${catColor}`, borderBottom: "1pt solid #e8e8e8" }}>
            <div style={{ fontFamily: PF.head, fontSize: "7pt", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: catColor, marginBottom: "10pt" }}>
              Analysis Parameters — Brief Inputs
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5pt 32pt" }}>
              {inputPairs.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "8pt", alignItems: "baseline", borderBottom: "0.5pt solid #ebebeb", paddingBottom: "3pt" }}>
                  <span style={{ fontFamily: PF.head, fontSize: "6.5pt", color: "#aaa", minWidth: "90pt", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.key}</span>
                  <span style={{ fontFamily: PF.body, fontSize: "9pt", color: "#111", fontWeight: 600 }}>{p.val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ContentPage>

      {/* ══════════════════════════════════════════════
          PAGE 4 — FOREWORD
      ══════════════════════════════════════════════ */}
      <ContentPage title={brief.title} refId={refId} dateStr={dateStr} pageNum={4} year={year} bottomAlign>
        <div className="pr-section-number">Section II</div>
        <div className="pr-h1">Foreword</div>

        <img src={principalPortraitImg} alt="Principal, The Gentry Lab"
          className="pr-foreword-photo"
          style={{ float: "right", width: "82pt", marginLeft: "16pt", marginBottom: "10pt", border: "0.5pt solid #e0e0e0" }}
        />

        <p className="pr-p">
          Cambodia has undergone a remarkable industrial transformation over the past two decades. From a largely agrarian economy in the early 2000s to Southeast Asia's fastest-growing garment and electronics export platform, the Kingdom has consistently outperformed regional peers in attracting quality manufacturing investment.
        </p>
        <p className="pr-p">
          Yet for all its momentum, Cambodia's industrial landscape remains navigable only to those with deep in-country intelligence. Land tenure complexity, utility bottlenecks, permit sequencing challenges, and the rapidly evolving regulatory environment conspire to extend timelines, inflate budgets, and discourage otherwise well-positioned investors.
        </p>
        <p className="pr-p">
          The Gentry Lab was established precisely to close this gap. Our AI Industrial Advisor platform synthesises over a decade of on-the-ground advisory experience, 60-plus delivered industrial projects, and the most comprehensive spatial and regulatory intelligence database available for Cambodia's industrial sector.
        </p>
        <p className="pr-p">
          The report you are reading represents our best analytical intelligence applied to your specific investment thesis. It is designed not merely as a reference document, but as an action-oriented advisory brief — identifying the most viable pathways, the critical risks requiring mitigation, and the concrete next steps that will determine the success of your engagement.
        </p>
        <p className="pr-p">
          We trust it serves as a valuable foundation for your decision-making. The Gentry Lab team remains available to deepen this analysis, conduct site visits, and manage the full development advisory lifecycle on your behalf.
        </p>

        <div className="pr-foreword-sig">
          <strong>The Gentry Lab Advisory Team</strong><br />
          AI Industrial Advisor Platform · Phnom Penh, Cambodia<br />
          advisory@thegentrylab.io · thegentrylab.io
        </div>
      </ContentPage>

      {/* ══════════════════════════════════════════════
          PAGE 5 — TABLE OF CONTENTS + ACRONYMS
      ══════════════════════════════════════════════ */}
      <ContentPage title={brief.title} refId={refId} dateStr={dateStr} pageNum={5} year={year}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32pt" }}>
          <div>
            <div className="pr-section-number">Contents</div>
            <div className="pr-h1" style={{ fontSize: "15pt", marginBottom: "14pt" }}>Table of Contents</div>
            {tocItems.map(item => (
              <div key={item.num} className="pr-toc-row">
                <span className="pr-toc-num">{item.num}</span>
                <span className="pr-toc-text">{item.title}</span>
                <span className="pr-toc-page">{item.page}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="pr-section-number">Section III</div>
            <div className="pr-h1" style={{ fontSize: "15pt", marginBottom: "14pt" }}>Acronyms</div>
            {acronyms.map(a => (
              <div key={a.key} className="pr-acronym-row">
                <span className="pr-acronym-key">{a.key}</span>
                <span className="pr-acronym-val">{a.val}</span>
              </div>
            ))}
          </div>
        </div>
      </ContentPage>

      {/* ══════════════════════════════════════════════
          PAGE 6 — EXECUTIVE SUMMARY
      ══════════════════════════════════════════════ */}
      <ContentPage title={brief.title} refId={refId} dateStr={dateStr} pageNum={6} year={year}>
        <div className="pr-section-number">Section IV</div>
        <div className="pr-h1">Executive Summary</div>

        {/* Two-column photo strip — satellite + category image */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8pt", marginBottom: "12pt" }}>
          <div className="pr-figure" style={{ margin: 0 }}>
            <img src={coverImageUrl} alt="Province satellite view"
              style={{ width: "100%", height: "80pt", objectFit: "cover", objectPosition: "center", display: "block" }}
              onError={(e) => { (e.target as HTMLImageElement).src = heroBlueprintImg; }} />
            <div className="pr-figure-caption">Aerial view — {form.province_preference || form.location || form.province || form.target_province || "Kingdom of Cambodia"}</div>
          </div>
          <div className="pr-figure" style={{ margin: 0 }}>
            <img src={analysisImageUrl} alt={brief.title}
              style={{ width: "100%", height: "80pt", objectFit: "cover", objectPosition: "center", display: "block" }}
              onError={(e) => { (e.target as HTMLImageElement).src = heroBlueprintImg; }} />
            <div className="pr-figure-caption">{cat.label} — Cambodia industrial sector</div>
          </div>
        </div>

        <div className="pr-exec-box">
          <div className="pr-exec-box-title">Key Findings at a Glance</div>
          {[
            "This brief addresses a specific industrial investment opportunity within Cambodia's rapidly evolving manufacturing and development landscape, applying GentryLab's proprietary analytical framework to the parameters provided.",
            "Cambodia's industrial sector continues to demonstrate strong fundamentals for foreign direct investment: competitive labour costs, improving infrastructure, an expanding network of Special Economic Zones, and increasingly streamlined QIP incentive pathways.",
            "The findings presented herein are based on a synthesis of official regulatory sources, multilateral development institution data, and The Gentry Lab's proprietary site intelligence and EPC benchmarking databases, current as of the date of generation.",
            "Key risks identified pertain to utility infrastructure readiness, land tenure verification, permit sequencing complexity, and the need for careful due diligence on the regulatory timeline applicable to the investment scale and sector.",
            "The Gentry Lab recommends a structured engagement process beginning with site shortlisting and title verification, proceeding through utility feasibility assessment, and culminating in a comprehensive QIP pre-application review prior to any capital commitment.",
          ].map((finding, i) => (
            <div key={i} className="pr-exec-finding">
              <div className="pr-exec-finding-num">{i + 1}</div>
              <div>{finding}</div>
            </div>
          ))}
        </div>

        <p className="pr-p">
          The following report presents the full analytical output from the GentryLab AI Industrial Advisor, structured to guide the reader from strategic context through site-level analysis to actionable recommendations. Data visualisations, comparative tables, and Gantt-format timeline projections are included to support decision-making at the board and operational levels.
        </p>
        <p className="pr-p">
          This document should be read in conjunction with primary source verification from the applicable Cambodian government ministries, and where investment commitment is intended, supplemented by independent legal and financial due diligence from qualified practitioners operating within the Kingdom of Cambodia.
        </p>

        {/* Stat boxes — dynamic from output + Cambodia context */}
        {(() => {
          const dynStats = extractPrintKeyStats(output);
          const baseStats = [
            { value: "43", label: "Active SEZs & Industrial Parks" },
            { value: "9yr", label: "Max Corporate Tax Holiday (QIP)" },
            { value: "$204", label: "Monthly Minimum Wage (2024)" },
            { value: "8–12%", label: "Annual Investment Growth Rate" },
            { value: "25+", label: "Cambodia Provinces Covered" },
            { value: "60+", label: "TGL Delivered Projects" },
          ];
          const allStats = [...dynStats, ...baseStats.filter(b => !dynStats.find(d => d.label === b.label))].slice(0, 6);
          return (
            <div className="pr-stat-grid" style={{ marginTop: "16pt" }}>
              {allStats.map((s, i) => (
                <div key={i} className="pr-stat-cell">
                  <div className="pr-stat-value" style={{ color: catColor }}>{s.value}</div>
                  <div className="pr-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </ContentPage>

      {/* ══════════════════════════════════════════════
          PAGE 7 — DATA VISUALISATIONS (gradient divider first)
      ══════════════════════════════════════════════ */}
      <div className="pr-gradient-page pr-page-break"
        style={{ background: `linear-gradient(135deg, #0d1117 0%, ${catColor}cc 50%, #0d1117 100%)` }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${heroBlueprintImg})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.12 }} />
        <div className="pr-gradient-content">
          <div className="pr-gradient-section-label">Section V</div>
          <div className="pr-gradient-title">Data &amp;<br />Visualisations</div>
          <div className="pr-gradient-sub">
            Infographic summaries, comparative charts, spatial mapping, and timeline projections derived from GentryLab's analytical framework.
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 8 — VISUALISATIONS
      ══════════════════════════════════════════════ */}
      <ContentPage title={brief.title} refId={refId} dateStr={dateStr} pageNum={8} year={year}>
        {/* ── Site Selection visualisations ── */}
        {ssd && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12pt", marginBottom: "14pt" }}>
              <div>
                <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Key Market Indicators</div>
                <SvgKeyStats stats={ssd.key_stats} zones={ssd.zones} />
              </div>
              {ssd.cost_breakdown && ssd.cost_breakdown.length > 0 && (
                <div><SvgPieChart slices={ssd.cost_breakdown} title="Total Investment Breakdown (%)" /></div>
              )}
            </div>
            <div style={{ marginBottom: "14pt" }}><SvgCambodiaMap zones={ssd.zones} /></div>
            <div style={{ marginBottom: "14pt" }}>
              <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Zone Scoring — Criteria Breakdown</div>
              <SvgZoneScoringChart zones={ssd.zones} />
            </div>
            <div style={{ marginBottom: "14pt" }}>
              <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Project Timeline — Gantt Chart</div>
              <SvgTimeline timeline={ssd.timeline_weeks} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12pt", marginBottom: "14pt" }}>
              <div>
                <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Cost Comparison by Zone</div>
                <SvgCostChart costs={ssd.costs} />
              </div>
              {ssd.labour_pool?.length > 0 && (
                <div><SvgLabourPoolChart labour={ssd.labour_pool} /></div>
              )}
            </div>
            <table className="pr-table">
              <thead><tr>{["Zone","Land /m²/yr","Build /m²","Utilities /mo","Permits","Area"].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{ssd.costs.map((c, i) => (
                <tr key={c.zone}>
                  <td style={{ fontWeight: 700, color: PCOLS[i % PCOLS.length] }}>{c.zone}</td>
                  <td style={{ textAlign: "center" }}>${c.land_lease_m2_yr}</td>
                  <td style={{ textAlign: "center" }}>${c.build_cost_m2}</td>
                  <td style={{ textAlign: "center" }}>${c.utilities_usd.toLocaleString()}</td>
                  <td style={{ textAlign: "center" }}>${c.permits_usd.toLocaleString()}</td>
                  <td style={{ textAlign: "center" }}>{c.factory_size_m2.toLocaleString()} m²</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="pr-table-caption">Table V.1 — Estimated capital expenditure by zone. Source: TGL EPC Benchmark Database [14].</div>

            <table className="pr-table" style={{ marginTop: "10pt" }}>
              <thead><tr>{["Rank","Zone","Province","Type","Score","Labour","Cost","Permits","Infra","Risk"].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{ssd.zones.map((z, i) => (
                <tr key={z.name}>
                  <td style={{ fontWeight: 700, color: PCOLS[i % PCOLS.length], textAlign: "center" }}>#{z.rank}</td>
                  <td style={{ fontWeight: 700 }}>{z.name}</td>
                  <td style={{ color: "#666" }}>{z.province}</td>
                  <td style={{ color: "#888", fontSize: "8pt" }}>{z.zone_type}</td>
                  <td style={{ fontWeight: 700, color: "#cc3300", textAlign: "center" }}>{z.score}</td>
                  <td style={{ textAlign: "center" }}>{z.labour}/10</td>
                  <td style={{ textAlign: "center" }}>{z.cost}/10</td>
                  <td style={{ textAlign: "center" }}>{z.permits}/10</td>
                  <td style={{ textAlign: "center" }}>{z.infrastructure}/10</td>
                  <td style={{ textAlign: "center" }}>{z.risk}/10</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="pr-table-caption">Table V.2 — Zone rankings by composite score. Source: TGL Site Intelligence Database [13].</div>
          </>
        )}

        {/* ── Generic visualisations ── */}
        {gd && (
          <>
            {gd.key_metrics?.length > 0 && (
              <div style={{ marginBottom: "14pt" }}>
                <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Key Figures</div>
                <SvgGenericMetrics metrics={gd.key_metrics} />
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12pt", marginBottom: "14pt" }}>
              {gd.pie_data && gd.pie_data.length > 0 && (
                <div><SvgPieChart slices={gd.pie_data} title="Distribution Breakdown" /></div>
              )}
              {gd.timeline_items?.length > 0 && (
                <div>
                  <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6pt" }}>Project Timeline</div>
                  <SvgGenericTimeline items={gd.timeline_items} />
                </div>
              )}
            </div>
            {gd.comparison_table?.headers?.length > 0 && (
              <>
                <table className="pr-table">
                  <thead><tr>{gd.comparison_table.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{gd.comparison_table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
                </table>
                <div className="pr-table-caption">Table V.1 — Comparative analysis. Source: TGL AI Industrial Advisor [13].</div>
              </>
            )}
          </>
        )}
        {/* ── Fallback when no structured chart data (Finance, Bankability, etc.) ── */}
        {!ssd && !gd && <PrintFallbackViz output={output} catColor={catColor} />}
      </ContentPage>

      {/* ══════════════════════════════════════════════
          GRADIENT DIVIDER — Analysis Section
      ══════════════════════════════════════════════ */}
      <div className="pr-gradient-page pr-page-break"
        style={{ background: `linear-gradient(160deg, ${catColor}dd 0%, #0d1117 60%)` }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${heroBlueprintImg})`, backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.08 }} />
        <div className="pr-gradient-content">
          <div className="pr-gradient-section-label">Section VI</div>
          <div className="pr-gradient-title">Analysis &amp;<br />Findings</div>
          <div className="pr-gradient-sub">
            Full advisory analysis generated by the GentryLab AI Industrial Advisor based on your brief parameters.
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          CONTENT PAGES — Brief body (renderPrintMarkdown)
      ══════════════════════════════════════════════ */}
      {/* CSS table trick: thead/tfoot repeat on every printed page */}
      <table className="pr-cpage-table pr-page-break" style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
        <thead className="pr-cpage-thead">
          <tr><td style={{ padding: 0 }}><PRHeader title={brief.title} refId={refId} dateStr={dateStr} /></td></tr>
        </thead>
        <tfoot className="pr-cpage-tfoot">
          <tr><td style={{ padding: 0 }}><PRFooter pageNum={9} refId={refId} year={year} /></td></tr>
        </tfoot>
        <tbody className="pr-cpage-tbody">
          <tr><td style={{ padding: "14pt 20mm 10pt", verticalAlign: "top" }}>
            {/* Analysis section opener — category-relevant hero image */}
            <div className="pr-figure" style={{ marginBottom: "14pt" }}>
              <img src={analysisImageUrl} alt={brief.title}
                style={{ width: "100%", height: "140pt", objectFit: "cover", objectPosition: "center", display: "block" }}
                onError={(e) => { (e.target as HTMLImageElement).src = coverImageUrl; (e.target as HTMLImageElement).onerror = () => { (e.target as HTMLImageElement).src = heroBlueprintImg; }; }}
              />
              <div className="pr-figure-caption">
                <strong>Figure VI.1</strong> — {brief.title}. Source: TheGentryLab.io · ESRI World Imagery
              </div>
            </div>
            {renderPrintMarkdown(output, catColor)}
          </td></tr>
        </tbody>
      </table>

      {/* ══════════════════════════════════════════════
          REFERENCES PAGE (standalone)
      ══════════════════════════════════════════════ */}
      <ContentPage title={brief.title} refId={refId} dateStr={dateStr} pageNum={12} year={year} bottomAlign>
        <div className="pr-section-number">Section VIII</div>
        <div className="pr-h1">References &amp; Data Sources</div>

        <p className="pr-p" style={{ marginBottom: "12pt" }}>
          The following references constitute the primary data sources informing the analytical framework applied in this report. All sources were current as of the date of generation. Investors are advised to verify the currency of regulatory and market data directly with the issuing authority prior to making investment commitments.
        </p>

        {references.map(s => (
          <div key={s.ref} className="pr-ref-item">
            <span className="pr-ref-num">[{s.ref}]</span>
            <div>
              <span>{s.src}</span>
              {" "}
              <span style={{ fontFamily: "monospace", fontSize: "7pt", color: "#aaa" }}>{s.url}</span>
            </div>
          </div>
        ))}
      </ContentPage>

      {/* ══════════════════════════════════════════════
          DISCLAIMER PAGE (standalone — small, understated)
      ══════════════════════════════════════════════ */}
      <ContentPage title={brief.title} refId={refId} dateStr={dateStr} pageNum={13} year={year} extraClass="pr-disclaimer-page" bottomAlign>
        <div className="pr-section-number">Important Notice</div>
        <div className="pr-h1">Disclaimer</div>

        <p className="pr-p">
          This report was produced by the GentryLab AI Industrial Advisor — an artificial intelligence platform developed and operated by The Gentry Lab. By reading or acting upon the content of this report, the recipient acknowledges and accepts the terms of this disclaimer in full.
        </p>

        <div className="pr-h2">Nature of the Analysis</div>
        <p className="pr-p">
          The analysis and recommendations contained in this report were generated by a large language model (AI) operating on the basis of the parameters provided at the time of generation. While the platform incorporates GentryLab's proprietary site intelligence database, EPC benchmarking data, and publicly available official sources, the output is inherently probabilistic in nature and reflects conditions as understood at the time of generation.
        </p>

        <div className="pr-h2">No Professional Advice</div>
        <p className="pr-p">
          This report does not constitute legal advice, financial advice, investment advice, environmental advice, or any other form of professional advisory service. Nothing in this report should be construed as a recommendation to commit capital, enter into any contract, or take any specific regulatory action. Readers should engage qualified legal, financial, and technical professionals operating within the relevant jurisdiction before making any investment or operational decision.
        </p>

        <div className="pr-h2">Data Currency &amp; Accuracy</div>
        <p className="pr-p">
          Regulations, tariff schedules, minimum wage levels, permit timelines, land availability, utility capacity, and market conditions in the Kingdom of Cambodia are subject to frequent change. The Gentry Lab makes no representation that the information contained herein is current, complete, or accurate as of any date subsequent to the date of generation. Data from third-party sources is reproduced in good faith but has not been independently audited.
        </p>

        <div className="pr-h2">Limitation of Liability</div>
        <p className="pr-p">
          To the maximum extent permitted by applicable law, The Gentry Lab, its directors, employees, and agents accept no liability for any loss, damage, cost, or expense (including consequential or indirect loss) arising from reliance upon this report or any decisions made in connection with its contents. The recipient assumes full responsibility for any use made of this report.
        </p>

        <div className="pr-h2">AI-Generated Content</div>
        <div className="pr-warn">
          <p className="pr-p" style={{ margin: 0, fontSize: "8.5pt" }}>
            This report was produced by an AI language model. It has not been reviewed, verified, or approved by a licensed human advisor prior to delivery. All quantitative figures, timelines, cost estimates, and regulatory references must be independently verified before use in any business plan, feasibility study, investment memorandum, or due diligence process.
          </p>
        </div>

        <div style={{ marginTop: "24pt", padding: "10pt 14pt", backgroundColor: "#f8f8f8", border: "1pt solid #e8e8e8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: PF.head, fontSize: "7pt", color: "#cc3300", fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase" }}>THE GENTRY LAB</div>
          <div style={{ fontFamily: "monospace", fontSize: "6.5pt", color: "#aaa" }}>© {year} The Gentry Lab · thegentrylab.io · advisory@thegentrylab.io</div>
        </div>
      </ContentPage>

      {/* ══════════════════════════════════════════════
          METADATA PAGE — Report provenance + QR
      ══════════════════════════════════════════════ */}
      <ContentPage title={brief.title} refId={refId} dateStr={dateStr} pageNum={14} year={year} extraClass="pr-metadata-page" bottomAlign>
        <div className="pr-section-number">Report Provenance</div>
        <div className="pr-h1">Document Metadata</div>

        <p className="pr-p" style={{ marginBottom: "18pt" }}>
          This page records the provenance and generation parameters of this report for audit, archive, and verification purposes.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24pt" }}>

          {/* Left: metadata table */}
          <div>
            <div className="pr-h3">Report Details</div>
            {[
              { label: "Reference ID",      value: `#${refId}` },
              { label: "Generated",         value: `${dateStr}` },
              { label: "Time",              value: timeStr },
              { label: "Brief Type",        value: brief.title },
              { label: "Category",          value: cat.label },
              { label: "Report Type",       value: reportType === "comprehensive" ? "Comprehensive Analysis" : "Standard Brief" },
              { label: "Jurisdiction",      value: "Kingdom of Cambodia" },
              { label: "Platform",          value: "GentryLab AI Industrial Advisor" },
              { label: "Platform URL",      value: "thegentrylab.io/tools/advisor" },
              { label: "Contact",           value: "advisory@thegentrylab.io" },
            ].map(m => (
              <div key={m.label} style={{ display: "flex", gap: "8pt", alignItems: "flex-start", borderBottom: "0.5pt solid #f0f0f0", padding: "4pt 0" }}>
                <span style={{ fontFamily: PF.head, fontSize: "7pt", color: "#aaa", minWidth: "80pt", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: "1pt" }}>{m.label}</span>
                <span style={{ fontFamily: PF.body, fontSize: "8.5pt", color: "#222", fontWeight: 500 }}>{m.value}</span>
              </div>
            ))}

            <div className="pr-h3" style={{ marginTop: "16pt" }}>Exported By</div>
            {[
              { label: "Name",    value: exportedBy },
              { label: "Email",   value: exportedEmail },
              { label: "User ID", value: exportedId },
              { label: "Export Date", value: `${dateStr} ${timeStr}` },
            ].map(m => (
              <div key={m.label} style={{ display: "flex", gap: "8pt", alignItems: "flex-start", borderBottom: "0.5pt solid #f0f0f0", padding: "4pt 0" }}>
                <span style={{ fontFamily: PF.head, fontSize: "7pt", color: "#aaa", minWidth: "80pt", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: "1pt" }}>{m.label}</span>
                <span style={{ fontFamily: PF.body, fontSize: "8.5pt", color: "#222", fontWeight: 500 }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Right: QR + analysis parameters */}
          <div>
            <div className="pr-h3">Verify &amp; Access Online</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16pt 0 12pt", gap: "10pt" }}>
              <div style={{ backgroundColor: "#fff", border: "1pt solid #e8e8e8", padding: "10pt", display: "inline-block", lineHeight: 0 }}>
                <QRCodeSVG value={reportUrl} size={110} bgColor="#ffffff" fgColor="#0a0a0b" level="Q" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: PF.head, fontSize: "7pt", fontWeight: 700, color: "#cc3300", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "3pt" }}>
                  Scan to access platform
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "7pt", color: "#888" }}>
                  thegentrylab.io/tools/advisor
                </div>
              </div>
            </div>

            <div className="pr-h3" style={{ marginTop: "8pt" }}>Analysis Parameters</div>
            {Object.entries(form).filter(([, v]) => v).map(([k, v]) => {
              const lbl = brief.fields.find(f => f.id === k)?.label ?? k;
              return (
                <div key={k} style={{ display: "flex", gap: "8pt", alignItems: "flex-start", borderBottom: "0.5pt solid #f0f0f0", padding: "3pt 0" }}>
                  <span style={{ fontFamily: PF.head, fontSize: "7pt", color: "#aaa", minWidth: "80pt", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.06em", paddingTop: "1pt" }}>{lbl}</span>
                  <span style={{ fontFamily: PF.body, fontSize: "8pt", color: "#333" }}>{v}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom stamp */}
        <div style={{ marginTop: "28pt", borderTop: "2pt solid #cc3300", paddingTop: "10pt", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: PF.head, fontSize: "8pt", fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "#cc3300" }}>THE GENTRY LAB</div>
            <div style={{ fontFamily: PF.head, fontSize: "6.5pt", color: "#aaa", letterSpacing: "0.1em", marginTop: "1pt" }}>AI Industrial Advisor · Kingdom of Cambodia</div>
          </div>
          <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: "6.5pt", color: "#bbb", lineHeight: 1.7 }}>
            <div>advisory@thegentrylab.io</div>
            <div>thegentrylab.io</div>
            <div>© {year} The Gentry Lab</div>
          </div>
        </div>
      </ContentPage>
    </div>
  );
}

/* ── Saved Briefs history component ─────────────────────── */
const HISTORY_FAVS_KEY = "tgl_brief_favs";
function getFavs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(HISTORY_FAVS_KEY) ?? "[]")); } catch { return new Set(); }
}
function saveFavs(favs: Set<string>) {
  localStorage.setItem(HISTORY_FAVS_KEY, JSON.stringify([...favs]));
}

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
  const [favs, setFavs] = useState<Set<string>>(getFavs);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [filterFavs, setFilterFavs] = useState(false);
  const [groupBy, setGroupBy] = useState<"none" | "category">("none");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");

  function toggleFav(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = new Set(favs);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFavs(next);
    saveFavs(next);
  }

  function sendToChat(b: SavedBrief, e: React.MouseEvent) {
    e.stopPropagation();
    const preview = b.output?.replace(/[#>*`|]/g, "").replace(/\s+/g, " ").slice(0, 600) ?? "";
    const msg = `I'd like to discuss my "${b.brief_title}" brief (${b.category} category). Here's a summary:\n\n${preview}...\n\nCan you help me dig deeper, explore alternative approaches, or answer follow-up questions?`;
    window.dispatchEvent(new CustomEvent("tgl:chat-brief", { detail: { message: msg } }));
  }

  let displayed = [...briefs];
  if (filterFavs) displayed = displayed.filter(b => favs.has(b.id));
  if (sortBy === "name") displayed.sort((a, b) => a.brief_title.localeCompare(b.brief_title));

  const grouped: Record<string, SavedBrief[]> = {};
  if (groupBy === "category") {
    for (const b of displayed) {
      (grouped[b.category] = grouped[b.category] ?? []).push(b);
    }
  } else {
    grouped["all"] = displayed;
  }

  function BriefCard({ b }: { b: SavedBrief }) {
    const color = catColors[b.category] ?? "#ff5100";
    const date = new Date(b.created_at);
    const preview = b.output?.replace(/[#>*`|]/g, "").replace(/\n/g, " ").slice(0, 110) ?? "";
    const isFav = favs.has(b.id);

    if (viewMode === "list") {
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all group"
          style={{ backgroundColor: "var(--adv-card)", border: "1px solid var(--adv-border)" }}
          onClick={() => onOpen(b)}
          onMouseEnter={e => (e.currentTarget.style.borderColor = `${color}40`)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--adv-border)")}>
          <span className="font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded shrink-0" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}>{b.category}</span>
          <span className="text-[12.5px] font-semibold flex-1 truncate" style={{ color: "var(--adv-text-hi)" }}>{b.brief_title}</span>
          <span className="font-mono text-[9px] shrink-0" style={{ color: "var(--adv-text-faint)" }}>
            {date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
          </span>
          <button onClick={e => sendToChat(b, e)} title="Discuss in AiChat"
            className="flex items-center gap-1 px-2 py-1 rounded transition shrink-0"
            style={{ backgroundColor: "rgba(255,81,0,0.08)", color: "#ff5100", border: "1px solid rgba(255,81,0,0.20)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span className="font-mono text-[8px] uppercase tracking-widest hidden sm:block">Chat</span>
          </button>
          <button onClick={e => toggleFav(b.id, e)} title={isFav ? "Remove favorite" : "Add to favorites"}
            className="shrink-0 p-1.5 rounded transition"
            style={{ color: isFav ? "#ff5100" : "var(--adv-text-dim)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color }}>Open →</span>
        </div>
      );
    }

    return (
      <div className="text-left p-4 rounded-xl transition-all group cursor-pointer relative"
        style={{ backgroundColor: "var(--adv-card)", border: "1px solid var(--adv-border)" }}
        onClick={() => onOpen(b)}
        onMouseEnter={e => (e.currentTarget.style.borderColor = `${color}40`)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--adv-border)")}>
        {/* Fav + Chat actions */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <button onClick={e => sendToChat(b, e)} title="Send to AiChat"
            className="p-1.5 rounded transition opacity-0 group-hover:opacity-100"
            style={{ backgroundColor: "rgba(255,81,0,0.10)", color: "#ff5100" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button onClick={e => toggleFav(b.id, e)} title={isFav ? "Remove favorite" : "Favorite"}
            className="p-1.5 rounded transition"
            style={{ color: isFav ? "#ff5100" : "var(--adv-text-dim)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
        </div>
        <div className="flex items-center gap-2 mb-2 pr-14">
          <span className="font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded shrink-0" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}>{b.category}</span>
          <span className="text-[13px] font-semibold truncate" style={{ color: "var(--adv-text-hi)" }}>{b.brief_title}</span>
        </div>
        {preview && <p className="text-[11px] leading-relaxed line-clamp-2 mb-3" style={{ color: "var(--adv-text-dim)" }}>{preview}…</p>}
        <div className="flex items-center justify-between pt-2.5" style={{ borderTop: "1px solid var(--adv-border-sub)" }}>
          <span className="font-mono text-[9px]" style={{ color: "var(--adv-text-faint)" }}>
            {date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color }}>Open →</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-[16px] font-bold" style={{ color: "var(--adv-text-hi)" }}>My Briefs</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--adv-text-sub)" }}>
            {briefs.length} brief{briefs.length !== 1 ? "s" : ""} saved · Reopen to view, edit, or regenerate
          </p>
        </div>
        <button onClick={onNew} className="px-4 py-2 rounded-lg font-bold text-[12px] shrink-0" style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>
          + New Brief
        </button>
      </div>

      {/* Toolbar */}
      {!loading && briefs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5 pb-4" style={{ borderBottom: "1px solid var(--adv-border-sub)" }}>
          {/* Favorites filter */}
          <button onClick={() => setFilterFavs(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[9px] uppercase tracking-widest transition"
            style={{ backgroundColor: filterFavs ? "rgba(255,81,0,0.12)" : "var(--adv-card)", color: filterFavs ? "#ff5100" : "var(--adv-text-sec)", border: filterFavs ? "1px solid rgba(255,81,0,0.30)" : "1px solid var(--adv-border)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill={filterFavs ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            Favorites {filterFavs && `(${[...favs].filter(id => briefs.some(b => b.id === id)).length})`}
          </button>
          {/* Group by */}
          <button onClick={() => setGroupBy(v => v === "none" ? "category" : "none")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[9px] uppercase tracking-widest transition"
            style={{ backgroundColor: groupBy === "category" ? "rgba(59,130,246,0.10)" : "var(--adv-card)", color: groupBy === "category" ? "#3b82f6" : "var(--adv-text-sec)", border: groupBy === "category" ? "1px solid rgba(59,130,246,0.25)" : "1px solid var(--adv-border)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            {groupBy === "category" ? "Grouped" : "Group by type"}
          </button>
          {/* Sort */}
          <button onClick={() => setSortBy(v => v === "date" ? "name" : "date")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[9px] uppercase tracking-widest transition"
            style={{ backgroundColor: "var(--adv-card)", color: "var(--adv-text-sec)", border: "1px solid var(--adv-border)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
            Sort: {sortBy === "date" ? "Recent" : "Name"}
          </button>
          <div className="ml-auto flex items-center gap-1">
            {/* View toggle */}
            {(["card", "list"] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className="p-2 rounded transition"
                style={{ backgroundColor: viewMode === v ? "rgba(255,81,0,0.12)" : "var(--adv-card)", color: viewMode === v ? "#ff5100" : "var(--adv-text-sec)", border: "1px solid " + (viewMode === v ? "rgba(255,81,0,0.25)" : "var(--adv-border)") }}>
                {v === "card"
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                }
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-12 justify-center" style={{ color: "var(--adv-text-dim)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          <span className="font-mono text-[10px] uppercase tracking-widest">Loading briefs...</span>
        </div>
      )}

      {!loading && briefs.length === 0 && (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "var(--adv-card)", border: "1px solid var(--adv-border-input)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ color: "var(--adv-text-dim)" }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <p className="text-[13px]" style={{ color: "var(--adv-text-muted)" }}>No saved briefs yet.</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--adv-text-faint)" }}>Generate your first brief to see it here.</p>
          <button onClick={onNew} className="mt-5 px-5 py-2.5 rounded-lg font-bold text-[12px]" style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100", border: "1px solid rgba(255,81,0,0.25)" }}>
            Generate a Brief →
          </button>
        </div>
      )}

      {!loading && displayed.length === 0 && briefs.length > 0 && (
        <div className="text-center py-12">
          <p className="text-[13px]" style={{ color: "var(--adv-text-muted)" }}>No briefs match your filter.</p>
          <button onClick={() => setFilterFavs(false)} className="mt-3 font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>Clear filter</button>
        </div>
      )}

      {!loading && Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="mb-6">
          {groupBy === "category" && (
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${catColors[group] ?? "#ff5100"}15`, color: catColors[group] ?? "#ff5100", border: `1px solid ${catColors[group] ?? "#ff5100"}30` }}>
                {group}
              </span>
              <span className="font-mono text-[9px]" style={{ color: "var(--adv-text-faint)" }}>{items.length} brief{items.length !== 1 ? "s" : ""}</span>
            </div>
          )}
          <div className={viewMode === "card" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-1.5"}>
            {items.map(b => <BriefCard key={b.id} b={b} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────── */
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
  const [actualCost, setActualCost] = useState<number | null>(null);
  const { credits, refresh: refreshCredits } = useCredits();
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

    // ── Slide 1: Cover ──────────────────────────────────
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

    // ── Slide 2: Analysis Parameters ─────────────────────
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

    // ── Slide 3: Key Statistics Infographic ──────────────
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

    // ── Slide 4: Charts ───────────────────────────────────
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

    // ── Content slides ────────────────────────────────────
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

    // ── Last slide: Disclaimer ────────────────────────────
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
    setActualCost(null);
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

      // Extract <COST>N</COST> marker and actual credit charge
      const costMatch = accumulated.match(/<COST>(\d+)<\/COST>/);
      if (costMatch) {
        setActualCost(parseInt(costMatch[1], 10));
        accumulated = accumulated.replace(/\n?<COST>\d+<\/COST>/, "");
        setOutput(accumulated);
        refreshCredits();
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
    setActualCost(null);
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

      const costMatch2 = accumulated.match(/<COST>(\d+)<\/COST>/);
      if (costMatch2) {
        setActualCost(parseInt(costMatch2[1], 10));
        accumulated = accumulated.replace(/\n?<COST>\d+<\/COST>/, "");
        setOutput(accumulated);
        refreshCredits();
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
    setActualCost(null);
    setReportType("standard");
    setUserNotes("");
    setRefinePrompt("");
    setRefining(false);
  }

  const allFilled = selectedBrief?.fields.filter(f => f.required).every(f => form[f.id]?.trim());

  /* ── Render ── */
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
          user={user}
        />
      )}

      {/* Screen content */}
      <div className="advisor-screen min-h-screen" style={{ backgroundColor: "var(--adv-page-bg)", color: "var(--adv-text-hi)" }}>
        <TopNav />

        {/* Hero */}
        <div className="border-b" style={{ borderColor: "var(--adv-border-sub)", backgroundColor: "var(--adv-hero-bg)" }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-6 sm:py-10">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-[9px] uppercase tracking-[0.25em] px-2.5 py-1 rounded" style={{ color: "#ff5100", backgroundColor: "rgba(255,81,0,0.10)", border: "1px solid rgba(255,81,0,0.20)" }}>
                    AI Tool · Beta
                  </span>
                  {user && <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--adv-text-faint)" }}>Logged in · Credits active</span>}
                </div>
                <h1 className="text-[28px] md:text-[36px] font-extrabold tracking-tight leading-tight" style={{ color: "var(--adv-text-hi)" }}>
                  AI Industrial Advisor
                </h1>
                <p className="mt-2 text-[13px] leading-relaxed max-w-xl" style={{ color: "var(--adv-text-muted)" }}>
                  Generate structured investment briefs — site selection, feasibility, permits, finance, and more — powered by Cambodia ground-level data.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {user && step !== "history" && (
                  <button onClick={openHistory} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest transition"
                    style={{ border: "1px solid var(--adv-border-input)", color: "var(--adv-text-sec)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    My Briefs
                  </button>
                )}
                {step !== "select" && step !== "history" && (
                  <button onClick={reset} className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest rounded transition"
                    style={{ border: "1px solid var(--adv-border-input)", color: "var(--adv-text-muted)" }}>
                    ← New Brief
                  </button>
                )}
                {step === "history" && (
                  <button onClick={reset} className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest rounded transition"
                    style={{ border: "1px solid var(--adv-border-input)", color: "var(--adv-text-muted)" }}>
                    ← Back
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
                          style={{ backgroundColor: isActive ? "#ff5100" : isDone ? "rgba(255,81,0,0.30)" : "var(--adv-card)", color: isActive || isDone ? "#fff" : "var(--adv-text-dim)" }}>
                          {isDone ? "✓" : i + 1}
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-wider hidden sm:block"
                          style={{ color: isActive ? "#ff5100" : "var(--adv-text-faint)" }}>{labels[i]}</span>
                      </div>
                      {i < 2 && <div className="w-8 h-px" style={{ backgroundColor: "var(--adv-border)" }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-6 sm:py-10">

          {/* ── Auth gate ── */}
          {!user && (
            <div className="max-w-md mx-auto text-center py-16">
              <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: "rgba(255,81,0,0.10)", border: "1px solid rgba(255,81,0,0.20)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h2 className="text-[18px] font-bold mb-2" style={{ color: "var(--adv-text-hi)" }}>Sign in to use the Advisor</h2>
              <p className="text-[13px] mb-6" style={{ color: "var(--adv-text-muted)" }}>AI Industrial Advisor briefs require a free account.</p>
              <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px]"
                style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>
                Sign in free →
              </Link>
            </div>
          )}

          {/* ── History ── */}
          {user && step === "history" && (
            <HistoryView
              briefs={savedBriefs}
              loading={historyLoading}
              onOpen={reopenBrief}
              onNew={reset}
            />
          )}

          {/* ── Step 1: Select ── */}
          {user && step === "select" && (
            <div>
              <div className="flex flex-wrap gap-2 mb-8">
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setCategory(cat.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all"
                    style={{
                      backgroundColor: category === cat.id ? cat.color : "var(--adv-card)",
                      color: category === cat.id ? "#000" : "var(--adv-text-sec)",
                      border: `1px solid ${category === cat.id ? cat.color : "var(--adv-border)"}`,
                      fontWeight: category === cat.id ? 700 : 400,
                    }}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <p className="text-[12px]" style={{ color: "var(--adv-text-sub)" }}>{activeCat.desc}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catBriefs.map(b => (
                  <button key={b.id} onClick={() => selectBrief(b)} className="text-left group p-5 rounded-xl transition-all"
                    style={{ backgroundColor: "var(--adv-card)", border: "1px solid var(--adv-border)" }}
                    onMouseEnter={e => (e.currentTarget.style.border = `1px solid ${activeCat.color}40`)}
                    onMouseLeave={e => (e.currentTarget.style.border = "1px solid var(--adv-border)")}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${activeCat.color}12`, color: activeCat.color }}>{b.icon}</div>
                    <h3 className="text-[13px] font-bold mb-1.5 leading-snug" style={{ color: "var(--adv-text-hi)" }}>{b.title}</h3>
                    <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: "var(--adv-text-muted)" }}>{b.desc}</p>
                    <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: activeCat.color }}>For: {b.audience}</p>
                    <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid var(--adv-border-sub)" }}>
                      <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--adv-text-faint)" }}>{b.fields.length} inputs · ~30 sec</span>
                      <span className="ml-auto font-mono text-[9px]" style={{ color: activeCat.color }}>Generate →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Form ── */}
          {user && step === "form" && selectedBrief && (
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${activeCat.color}12`, color: activeCat.color }}>{selectedBrief.icon}</div>
                <div>
                  <h2 className="text-[16px] font-bold" style={{ color: "var(--adv-text-hi)" }}>{selectedBrief.title}</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--adv-text-sub)" }}>
                    {isEditMode ? "Edit your inputs and regenerate the brief" : "Fill in the details below to generate your brief"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {selectedBrief.fields.map(field => (
                  <div key={field.id}>
                    <label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "var(--adv-text-sec)" }}>
                      {field.label}{field.required && <span style={{ color: "#ff5100" }}> *</span>}
                    </label>
                    {field.type === "select" ? (
                      <CustomSelect
                        value={form[field.id] ?? ""}
                        onChange={v => setForm(p => ({ ...p, [field.id]: v }))}
                        options={field.options ?? []}
                      />
                    ) : (
                      <input type="text" value={form[field.id] ?? ""} onChange={e => setForm(p => ({ ...p, [field.id]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2.5 rounded-lg text-[12.5px] outline-none transition"
                        style={{ backgroundColor: "var(--adv-input-bg)", border: "1px solid var(--adv-border-input)", color: "var(--adv-text-hi)" }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Report type selector */}
              <div className="mt-8 rounded-xl p-4" style={{ backgroundColor: "var(--adv-card)", border: "1px solid var(--adv-border)" }}>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: "var(--adv-text-sub)" }}>Report Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["standard", "comprehensive"] as ReportType[]).map(rt => {
                    const isSelected = reportType === rt;
                    const cost = rt === "standard" ? CREDIT_COSTS.brief_standard : CREDIT_COSTS.brief_comprehensive;
                    return (
                      <button key={rt} onClick={() => setReportType(rt)}
                        className="text-left p-3 rounded-lg transition"
                        style={{ backgroundColor: isSelected ? "rgba(255,81,0,0.12)" : "rgba(255,255,255,0.03)", border: isSelected ? "1px solid rgba(255,81,0,0.40)" : "1px solid rgba(255,255,255,0.07)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[12px]" style={{ color: isSelected ? "#ff5100" : "var(--adv-text-body)" }}>
                            {rt === "standard" ? "Standard" : "Comprehensive"}
                          </span>
                          <span className="font-mono text-[9px]" style={{ color: isSelected ? "#ff5100" : "var(--adv-text-dim)" }}>~{cost} cr</span>
                        </div>
                        <p className="text-[10px] leading-relaxed" style={{ color: "var(--adv-text-sub)" }}>
                          {rt === "standard" ? "Structured text brief with full analysis and recommendations." : "Includes charts, cost tables, timeline visual, and scoring graphs."}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User notes */}
              <div className="mt-6 rounded-xl overflow-hidden" style={{ border: "1px solid var(--adv-border-input)" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "var(--adv-card)", borderBottom: "1px solid var(--adv-border)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--adv-text-sec)" }}>Your notes <span style={{ color: "var(--adv-text-faint)" }}>(optional)</span></p>
                </div>
                <div className="px-4 py-3">
                  <textarea
                    value={userNotes}
                    onChange={e => setUserNotes(e.target.value)}
                    placeholder="Add any specific focus areas, constraints, or context for the AI — e.g. 'Focus on garment sector', 'Budget under $5M', 'Priority is fast permit timeline'..."
                    rows={3}
                    className="w-full text-[12px] leading-relaxed outline-none resize-none transition"
                    style={{ backgroundColor: "transparent", color: "var(--adv-text-hi)", border: "none", padding: 0 }}
                  />
                </div>
              </div>

              {/* Credit error */}
              {creditError && (
                <div className="mt-4 rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <p className="font-bold text-[12px] mb-1" style={{ color: "#ef4444" }}>Insufficient credits</p>
                    <p className="text-[11px]" style={{ color: "var(--adv-text-muted)" }}>Your balance is {creditError.balance} cr. <Link to="/credits" className="underline" style={{ color: "#ff5100" }}>Buy more credits →</Link></p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-4">
                <button onClick={() => isEditMode ? setStep("result") : setStep("select")}
                  className="px-5 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest transition"
                  style={{ border: "1px solid var(--adv-border-input)", color: "var(--adv-text-muted)" }}>
                  ← {isEditMode ? "Cancel" : "Back"}
                </button>
                <button onClick={generate} disabled={!allFilled}
                  className="flex-1 px-5 py-2.5 rounded-lg font-bold text-[13px] transition disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>
                  {isEditMode ? "Regenerate Brief →" : "Generate Brief →"}
                </button>
              </div>
              <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--adv-text-ghost)" }}>
                Charged based on actual usage (2× API cost) · Auto-saved
              </p>
            </div>
          )}

          {/* ── Generating animation ── */}
          {step === "generating" && (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,81,0,0.10)", border: "1px solid rgba(255,81,0,0.20)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="1.6" className="animate-spin">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="font-bold text-[14px]" style={{ color: "var(--adv-text-hi)" }}>Generating your brief...</p>
                <p className="font-mono text-[10px] uppercase tracking-widest mt-1" style={{ color: "var(--adv-text-dim)" }}>Analysing Cambodia industrial data</p>
              </div>
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {user && step === "result" && selectedBrief && (
            <div className="max-w-3xl">
              {/* Result header — title row */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-base" style={{ backgroundColor: `${activeCat.color}15`, color: activeCat.color }}>{selectedBrief.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: `${activeCat.color}12`, color: activeCat.color }}>{activeCat.label}</span>
                    <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: reportType === "comprehensive" ? "rgba(139,92,246,0.10)" : "var(--adv-card)", color: reportType === "comprehensive" ? "#a78bfa" : "var(--adv-text-dim)", border: `1px solid ${reportType === "comprehensive" ? "rgba(139,92,246,0.25)" : "var(--adv-border)"}` }}>{reportType}</span>
                    {saved && !streaming && (
                      <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "#10b981" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Saved
                      </span>
                    )}
                    {streaming && (
                      <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--adv-text-dim)" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block" />Generating...
                      </span>
                    )}
                    {actualCost !== null && !streaming && (
                      <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--adv-text-sec)" }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        {actualCost} cr charged{credits ? ` · ${credits.balance} remaining` : ""}
                      </span>
                    )}
                  </div>
                  <h2 className="text-[16px] font-bold leading-snug" style={{ color: "var(--adv-text-hi)" }}>{selectedBrief.title}</h2>
                </div>
                <button onClick={reset} className="shrink-0 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest rounded-lg transition"
                  style={{ border: "1px solid rgba(255,81,0,0.30)", color: "#ff5100", backgroundColor: "rgba(255,81,0,0.05)" }}>
                  + New
                </button>
              </div>

              {/* Saved ref strip */}
              {savedBriefId && !streaming && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.12)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "#10b981" }}>Saved to your account</span>
                  <span className="font-mono text-[9px] ml-auto" style={{ color: "var(--adv-text-ghost)" }}>Ref #{savedBriefId.slice(0, 8).toUpperCase()}</span>
                  <button onClick={openHistory} className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--adv-text-dim)" }}>
                    View all →
                  </button>
                </div>
              )}

              {/* Brief output */}
              <div ref={outputRef} className="rounded-xl p-4 sm:p-6 md:p-8 min-h-[300px] sm:min-h-[400px]"
                style={{ backgroundColor: "var(--adv-hero-bg)", border: "1px solid var(--adv-border)" }}>
                {output ? renderMarkdown(output) : (
                  <div className="flex items-center gap-2" style={{ color: "var(--adv-text-dim)" }}>
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
                <div className="mt-6 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--adv-border-input)" }}>
                  {/* Header */}
                  <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: "var(--adv-card)", borderBottom: "1px solid var(--adv-border)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,81,0,0.12)", border: "1px solid rgba(255,81,0,0.25)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </div>
                    <div>
                      <p className="font-bold text-[13px]" style={{ color: "var(--adv-text-hi)" }}>Refine this report</p>
                      <p className="text-[11px]" style={{ color: "var(--adv-text-sub)" }}>Tell the AI what to adjust, expand, or focus on — it will regenerate using your inputs</p>
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
                          backgroundColor: refinePrompt === chip ? "rgba(255,81,0,0.15)" : "var(--adv-card)",
                          border: `1px solid ${refinePrompt === chip ? "rgba(255,81,0,0.40)" : "var(--adv-border-input)"}`,
                          color: refinePrompt === chip ? "#ff5100" : "var(--adv-text-muted)",
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
                      style={{ backgroundColor: "var(--adv-input-bg)", border: "1px solid var(--adv-border-input)", color: "var(--adv-text-hi)" }}
                    />
                    {creditError && (
                      <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "#ef4444" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Insufficient credits ({creditError.balance} cr). <Link to="/credits" className="underline ml-1" style={{ color: "#ff5100" }}>Buy more →</Link>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                      <span className="font-mono text-[9px]" style={{ color: "var(--adv-text-ghost)" }}>
                        Charged dynamically (2x API cost) · saves new version
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
                    Get Expert Review →
                  </a>
                </div>
              )}

              {/* Action buttons — bottom of page */}
              {!streaming && output && (
                <div className="flex items-center gap-2 flex-wrap mt-6 pt-5" style={{ borderTop: "1px solid var(--adv-border)" }}>
                  <button onClick={() => {
                    const preview = output.replace(/[#>*`|]/g, "").replace(/\s+/g, " ").slice(0, 600);
                    window.dispatchEvent(new CustomEvent("tgl:chat-brief", { detail: { message: `I'd like to discuss my "${selectedBrief.title}" brief.\n\n${preview}...\n\nCan you help me explore this deeper?` } }));
                  }} className="flex items-center gap-1.5 px-3.5 py-2 font-mono text-[9px] uppercase tracking-widest rounded-lg transition"
                    style={{ border: "1px solid rgba(255,81,0,0.35)", color: "#ff5100", backgroundColor: "rgba(255,81,0,0.06)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Discuss in Chat
                  </button>
                  <button onClick={editAndRegenerate} className="flex items-center gap-1.5 px-3.5 py-2 font-mono text-[9px] uppercase tracking-widest rounded-lg transition"
                    style={{ border: "1px solid var(--adv-border-mid)", color: "var(--adv-text-sec)", backgroundColor: "var(--adv-card)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit &amp; Regen
                  </button>
                  <button onClick={() => {
                    const prev = document.title;
                    const slug = selectedBrief.title.replace(/[^a-zA-Z0-9 \-–—]/g, "").replace(/\s+/g, "_").slice(0, 80);
                    document.title = `TGL_${slug}_${new Date().toISOString().slice(0, 10)}`;
                    window.print();
                    setTimeout(() => { document.title = prev; }, 3000);
                  }} className="flex items-center gap-1.5 px-3.5 py-2 font-mono text-[9px] uppercase tracking-widest rounded-lg transition"
                    style={{ border: "1px solid var(--adv-border-mid)", color: "var(--adv-text-sec)", backgroundColor: "var(--adv-card)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print / PDF
                  </button>
                  <button onClick={downloadAsPPT} className="flex items-center gap-1.5 px-3.5 py-2 font-mono text-[9px] uppercase tracking-widest rounded-lg transition"
                    style={{ border: "1px solid rgba(255,165,0,0.30)", color: "rgba(255,165,0,0.75)", backgroundColor: "rgba(255,165,0,0.05)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                    Download PPT
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

