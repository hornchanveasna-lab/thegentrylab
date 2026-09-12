import { useEffect, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
  PieChart, Pie, Cell,
} from "recharts";

const ORANGE = "#ff5100";
const AMBER = "#fbbf24";
const BLUE = "#38bdf8";
const GREEN = "#34d399";

/* ── Shared dark tooltip, matches the framework/$stageId.tsx pattern ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded px-3 py-2 text-xs border border-white/10 bg-[#141416]">
      {label && <p className="font-bold mb-1 text-white">{label}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          {unit ?? ""}
        </p>
      ))}
    </div>
  );
}

const axisTick = { fill: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "monospace" };

/* ── Count-up stat — animates from 0 once scrolled into view ── */
export function AnimatedStat({ value, suffix = "", label, color = ORANGE, decimals = 0 }: {
  value: number; suffix?: string; label: string; color?: string; decimals?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      const duration = 1200;
      const start = performance.now();
      function tick(now: number) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(value * eased);
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="border border-white/8 px-5 py-4 print:border-black/15">
      <p className="text-3xl font-extrabold tracking-tighter print:text-black" style={{ color }}>
        {display.toFixed(decimals)}{suffix}
      </p>
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mt-1 print:text-black/50">{label}</p>
    </div>
  );
}

function SourceNote({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[9px] uppercase tracking-widest text-white/20 mt-3 print:text-black/40">{children}</p>;
}

/* ── Cambodia's emerging tire-manufacturing cluster ──────────
 * Roadboss (planned, ISI SEZ) vs Sailun (existing + expanding, Svay
 * Rieng/PPSEZ) — shows this is becoming a multi-player hub, not one
 * factory. Figures from company/trade-press disclosures, Sept 2026. */
const tireCapacityData = [
  { name: "Roadboss\n(ISI SEZ)", PCR: 15, TBR: 2.6 },
  { name: "Sailun\n(Svay Rieng)", PCR: 21, TBR: 3.3 },
];

export function TireCapacityChart() {
  return (
    <div className="reveal border border-white/8 bg-white/[0.02] p-5 print:border-black/20">
      <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: ORANGE }}>Cambodia's Tire Manufacturing Cluster</p>
      <p className="text-[12px] text-white/50 mb-4 print:text-black/60">Planned annual capacity, million units/year — Roadboss is not Cambodia's only large tire investment.</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={tireCapacityData} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "rgba(255,255,255,0.15)" }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} unit="M" />
          <Tooltip content={<DarkTooltip unit="M units/yr" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }} />
          <Bar dataKey="PCR" name="Passenger (PCR)" fill={ORANGE} radius={[3, 3, 0, 0]} isAnimationActive animationDuration={900} />
          <Bar dataKey="TBR" name="Truck & Bus (TBR)" fill={AMBER} radius={[3, 3, 0, 0]} isAnimationActive animationDuration={900} animationBegin={150} />
        </BarChart>
      </ResponsiveContainer>
      <SourceNote>Sources: Roadboss company introduction (Jan 2026); Tyrepress / Tire Business, Sailun Cambodia capacity disclosures (2025)</SourceNote>
    </div>
  );
}

/* ── Sihanoukville port throughput trajectory ────────────────
 * Ties directly to section 03's "port is the advantage" argument. */
const portGrowthData = [
  { year: "2024", teu: 1.0 },
  { year: "2025", teu: 1.35 },
  { year: "2027", teu: 1.45 },
  { year: "2029", teu: 2.02 },
  { year: "2030", teu: 2.6 },
];

export function PortGrowthChart() {
  return (
    <div className="reveal border border-white/8 bg-white/[0.02] p-5 print:border-black/20">
      <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: BLUE }}>Sihanoukville Port — Container Growth</p>
      <p className="text-[12px] text-white/50 mb-4 print:text-black/60">Throughput, million TEU/year — the infrastructure the "port advantage" argument depends on is being built out now.</p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={portGrowthData}>
          <defs>
            <linearGradient id="portGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
              <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="year" tick={axisTick} axisLine={{ stroke: "rgba(255,255,255,0.15)" }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} unit="M" />
          <Tooltip content={<DarkTooltip unit="M TEU" />} />
          <Area type="monotone" dataKey="teu" name="Container throughput" stroke={BLUE} strokeWidth={2} fill="url(#portGradient)" isAnimationActive animationDuration={1100} />
        </AreaChart>
      </ResponsiveContainer>
      <SourceNote>Sources: Sihanoukville Autonomous Port statistics; Phnom Penh Post port-capacity reporting (2025)</SourceNote>
    </div>
  );
}

/* ── Rubber: the local supply-chain opportunity ──────────────
 * Ties to section 07 — how much of the raw-material base is already
 * in-country and active vs still coming online. */
const rubberData = [
  { name: "Actively producing", value: 330259, color: GREEN },
  { name: "In maintenance phase", value: 95184, color: "rgba(255,255,255,0.15)" },
];

export function RubberSupplyChart() {
  const total = rubberData.reduce((a, d) => a + d.value, 0);
  return (
    <div className="reveal border border-white/8 bg-white/[0.02] p-5 print:border-black/20">
      <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: GREEN }}>Cambodia's Rubber Base</p>
      <p className="text-[12px] text-white/50 mb-4 print:text-black/60">
        {total.toLocaleString()} hectares under cultivation nationwide — the raw-material footprint Roadboss's own local-rubber sourcing plan would draw on.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ResponsiveContainer width="100%" height={180} className="max-w-[200px]">
          <PieChart>
            <Pie data={rubberData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} isAnimationActive animationDuration={900}>
              {rubberData.map((d) => <Cell key={d.name} fill={d.color} stroke="none" />)}
            </Pie>
            <Tooltip content={<DarkTooltip unit=" ha" />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-3 flex-1">
          {rubberData.map((d) => (
            <div key={d.name} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color === "rgba(255,255,255,0.15)" ? "rgba(255,255,255,0.3)" : d.color }} />
              <span className="text-[12px] text-white/70 print:text-black/70">{d.name}</span>
              <span className="ml-auto font-mono text-[11px] text-white/40">{d.value.toLocaleString()} ha</span>
            </div>
          ))}
          <p className="text-[11px] text-white/40 mt-1 print:text-black/50">Rubber export revenue: <span style={{ color: GREEN }} className="font-semibold">+42% YoY</span> in the first 7 months of 2025.</p>
        </div>
      </div>
      <SourceNote>Sources: Cambodia rubber plantation review (2025); Rubber World / The Better Cambodia export reporting (2025)</SourceNote>
    </div>
  );
}

/* ── Investment momentum feeding the SEZ system ──────────────
 * Ties to section 06/12 — the macro capital flow this one factory sits
 * inside of. */
const sezInvestmentData = [
  { period: "2025\n(full year)", usd: 10.0, jobs: null },
  { period: "H1 2026", usd: 4.7, jobs: 160000 },
];

export function SezInvestmentChart() {
  return (
    <div className="reveal border border-white/8 bg-white/[0.02] p-5 print:border-black/20">
      <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: ORANGE }}>Investment Feeding the SEZ System</p>
      <p className="text-[12px] text-white/50 mb-4 print:text-black/60">CDC-approved fixed investment, USD billion — the scale of capital this one factory sits inside of.</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={sezInvestmentData} barCategoryGap="40%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="period" tick={axisTick} axisLine={{ stroke: "rgba(255,255,255,0.15)" }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} unit="B" />
          <Tooltip content={<DarkTooltip unit="B USD" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="usd" name="Approved investment" fill={ORANGE} radius={[3, 3, 0, 0]} isAnimationActive animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-white/40 mt-2 print:text-black/50">H1 2026's $4.7B in approvals is projected to create roughly <span className="text-white font-semibold print:text-black">160,000 jobs</span> across Cambodia — this is the pipeline a single anchor factory plugs into.</p>
      <SourceNote>Sources: Council for the Development of Cambodia (CDC) approval data, 2025–2026</SourceNote>
    </div>
  );
}
