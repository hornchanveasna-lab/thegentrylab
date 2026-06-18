import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { TopNav } from "@/components/site/TopNav";

export const Route = createFileRoute("/tools/advisor")({
  component: AdvisorPage,
});

/* ── Types ─────────────────────────────────────────────── */
type Category = "INVEST" | "DEVELOP" | "FINANCE" | "COMPLY" | "PLAN";
type Step = "select" | "form" | "generating" | "result";

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

const SECTORS = ["Garment & Textiles","Electronics & PCB","Food Processing","Warehousing & Logistics","Automotive / EV","Data Center","Energy / Solar","Pharmaceutical","Furniture","Footwear"];
const PROVINCES = ["Phnom Penh","Kandal","Kampong Speu","Sihanoukville","Svay Rieng","Kampong Cham","Kampot","Siem Reap","Battambang","Other / Recommend best"];
const BUDGET_RANGES = ["Under USD 1M","USD 1M – 5M","USD 5M – 20M","USD 20M – 50M","USD 50M – 100M","Over USD 100M"];
const FACTORY_SIZES = ["Under 1,000 m²","1,000 – 3,000 m²","3,000 – 10,000 m²","10,000 – 30,000 m²","30,000 – 65,000 m²","Over 65,000 m²"];

/* ── Brief definitions ──────────────────────────────────── */
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

/* ── Markdown renderer ──────────────────────────────────── */
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
      elements.push(
        <div key={i} className="my-3 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed" style={{ backgroundColor: "rgba(255,81,0,0.08)", borderLeft: "3px solid #ff5100", color: "rgba(255,255,255,0.80)" }}>
          {inlineMarkdown(line.slice(2))}
        </div>
      );
    } else if (line.startsWith("⚠️")) {
      elements.push(
        <div key={i} className="my-3 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed" style={{ backgroundColor: "rgba(245,158,11,0.08)", borderLeft: "3px solid #f59e0b", color: "rgba(255,255,255,0.80)" }}>
          {inlineMarkdown(line)}
        </div>
      );
    } else if (line.startsWith("✅")) {
      elements.push(
        <div key={i} className="my-3 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed" style={{ backgroundColor: "rgba(16,185,129,0.08)", borderLeft: "3px solid #10b981", color: "rgba(255,255,255,0.80)" }}>
          {inlineMarkdown(line)}
        </div>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 text-[12.5px] my-0.5" style={{ color: "rgba(255,255,255,0.70)" }}>
          <span style={{ color: "#ff5100" }} className="shrink-0 mt-0.5">·</span>
          <span>{inlineMarkdown(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\./.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2.5 text-[12.5px] my-1" style={{ color: "rgba(255,255,255,0.70)" }}>
          <span className="font-mono text-[10px] font-bold shrink-0 mt-0.5 w-4" style={{ color: "#ff5100" }}>{num}.</span>
          <span>{inlineMarkdown(line.replace(/^\d+\.\s*/, ""))}</span>
        </div>
      );
    } else if (line.startsWith("|")) {
      // Table
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<TableBlock key={`t-${i}`} rows={tableLines} />);
      continue;
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="my-4" style={{ borderColor: "rgba(255,255,255,0.08)" }} />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(<p key={i} className="text-[12.5px] leading-relaxed my-1" style={{ color: "rgba(255,255,255,0.65)" }}>{inlineMarkdown(line)}</p>);
    }
    i++;
  }
  return elements;
}

function inlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} style={{ color: "#ffffff" }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="px-1.5 py-0.5 rounded text-[11px] font-mono" style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100" }}>{p.slice(1, -1)}</code>;
    return p;
  });
}

function TableBlock({ rows }: { rows: string[] }) {
  const parsed = rows.map(r => r.split("|").map(c => c.trim()).filter(Boolean));
  const headers = parsed[0] ?? [];
  const body = parsed.filter((_, i) => i !== 1).slice(1);
  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-[11.5px]" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,81,0,0.30)" }}>
            {headers.map((h, i) => <th key={i} className="text-left py-2 px-3 font-mono uppercase tracking-wider text-[10px]" style={{ color: "#ff5100" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {row.map((cell, ci) => <td key={ci} className="py-2 px-3" style={{ color: "rgba(255,255,255,0.65)" }}>{inlineMarkdown(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
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
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const catBriefs = BRIEFS.filter(b => b.category === category);
  const activeCat = CATEGORIES.find(c => c.id === category)!;

  function selectBrief(b: BriefType) {
    setSelectedBrief(b);
    setForm({});
    setStep("form");
  }

  async function generate() {
    if (!selectedBrief) return;
    setStep("generating");
    setOutput("");
    setStreaming(true);
    setSaved(false);

    // small delay for animation
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
        body: JSON.stringify({ briefType: selectedBrief.id, briefTitle: selectedBrief.title, fields: form }),
      });

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

      // Save to Supabase
      if (user && supabase) {
        await supabase.from("advisor_briefs").insert({
          user_id: user.id,
          brief_type: selectedBrief.id,
          brief_title: selectedBrief.title,
          category: selectedBrief.category,
          fields: form,
          output: accumulated,
        });
        setSaved(true);
      }
    } catch (e) {
      setOutput("[Error: " + (e instanceof Error ? e.message : "Unknown error") + "]");
    } finally {
      setStreaming(false);
    }
  }

  function reset() { setStep("select"); setSelectedBrief(null); setOutput(""); setForm({}); setSaved(false); }

  const allFilled = selectedBrief?.fields.filter(f => f.required).every(f => form[f.id]?.trim());

  /* ── Render ── */
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0b", color: "#ffffff" }}>
      <TopNav />

      {/* Hero */}
      <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0d0d0e" }}>
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-10">
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
            {step !== "select" && (
              <button onClick={reset} className="font-mono text-[10px] uppercase tracking-widest px-4 py-2 rounded transition"
                style={{ border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }}>
                ← New Brief
              </button>
            )}
          </div>

          {/* Step indicator */}
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
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider hidden sm:block"
                      style={{ color: isActive ? "#ff5100" : "rgba(255,255,255,0.25)" }}>{labels[i]}</span>
                  </div>
                  {i < 2 && <div className="w-8 h-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 py-10">

        {/* ── Auth gate ── */}
        {!user && (
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: "rgba(255,81,0,0.10)", border: "1px solid rgba(255,81,0,0.20)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="text-[18px] font-bold mb-2" style={{ color: "#ffffff" }}>Sign in to use the Advisor</h2>
            <p className="text-[13px] mb-6" style={{ color: "rgba(255,255,255,0.40)" }}>AI Industrial Advisor briefs require a free account.</p>
            <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px]"
              style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>
              Sign in free →
            </Link>
          </div>
        )}

        {/* ── Step 1: Select ── */}
        {user && step === "select" && (
          <div>
            {/* Category tabs */}
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
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="mb-6">
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>{activeCat.desc}</p>
            </div>

            {/* Brief type cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catBriefs.map(b => (
                <button key={b.id} onClick={() => selectBrief(b)} className="text-left group p-5 rounded-xl transition-all"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                  onMouseEnter={e => (e.currentTarget.style.border = `1px solid ${activeCat.color}40`)}
                  onMouseLeave={e => (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.07)")}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-all"
                    style={{ backgroundColor: `${activeCat.color}12`, color: activeCat.color }}>
                    {b.icon}
                  </div>
                  <h3 className="text-[13px] font-bold mb-1.5 leading-snug" style={{ color: "#ffffff" }}>{b.title}</h3>
                  <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.40)" }}>{b.desc}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: activeCat.color }}>
                    For: {b.audience}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {b.fields.length} inputs · ~30 sec
                    </span>
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
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${activeCat.color}12`, color: activeCat.color }}>
                {selectedBrief.icon}
              </div>
              <div>
                <h2 className="text-[16px] font-bold" style={{ color: "#ffffff" }}>{selectedBrief.title}</h2>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Fill in the details below to generate your brief</p>
              </div>
            </div>

            <div className="space-y-4">
              {selectedBrief.fields.map(field => (
                <div key={field.id}>
                  <label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.50)" }}>
                    {field.label}{field.required && <span style={{ color: "#ff5100" }}> *</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={form[field.id] ?? ""}
                      onChange={e => setForm(p => ({ ...p, [field.id]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg text-[12.5px] outline-none transition appearance-none"
                      style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: form[field.id] ? "#ffffff" : "rgba(255,255,255,0.30)" }}>
                      <option value="">Select…</option>
                      {field.options?.map(o => <option key={o} value={o} style={{ backgroundColor: "#1a1a1a", color: "#ffffff" }}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={form[field.id] ?? ""}
                      onChange={e => setForm(p => ({ ...p, [field.id]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2.5 rounded-lg text-[12.5px] outline-none transition"
                      style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-8">
              <button onClick={() => setStep("select")} className="px-5 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest transition"
                style={{ border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }}>
                ← Back
              </button>
              <button onClick={generate} disabled={!allFilled}
                className="flex-1 px-5 py-2.5 rounded-lg font-bold text-[13px] transition disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>
                Generate Brief →
              </button>
            </div>
            <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.20)" }}>
              Uses 1 credit · Saved to your account
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
              <p className="font-bold text-[14px]" style={{ color: "#ffffff" }}>Generating your brief…</p>
              <p className="font-mono text-[10px] uppercase tracking-widest mt-1" style={{ color: "rgba(255,255,255,0.30)" }}>Analysing Cambodia industrial data</p>
            </div>
          </div>
        )}

        {/* ── Step 3: Result ── */}
        {user && step === "result" && selectedBrief && (
          <div className="max-w-3xl">
            {/* Actions bar */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: `${activeCat.color}12`, color: activeCat.color }}>
                  {selectedBrief.icon}
                </div>
                <h2 className="text-[14px] font-bold" style={{ color: "#ffffff" }}>{selectedBrief.title}</h2>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {saved && (
                  <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest" style={{ color: "#10b981" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Saved
                  </span>
                )}
                {streaming && (
                  <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.30)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />Generating…
                  </span>
                )}
                <button onClick={() => window.print()} className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest rounded transition"
                  style={{ border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.40)" }}>
                  Print
                </button>
                <button onClick={reset} className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest rounded transition"
                  style={{ border: "1px solid rgba(255,81,0,0.30)", color: "#ff5100" }}>
                  New Brief
                </button>
              </div>
            </div>

            {/* Brief output */}
            <div ref={outputRef} className="rounded-xl p-6 md:p-8 min-h-[400px]"
              style={{ backgroundColor: "#0d0d0e", border: "1px solid rgba(255,255,255,0.07)" }}>
              {output ? renderMarkdown(output) : (
                <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.30)" }}>
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "120ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "240ms" }}>·</span>
                </div>
              )}
            </div>

            {/* Advisory CTA */}
            {!streaming && output && (
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
          </div>
        )}
      </div>
    </div>
  );
}
