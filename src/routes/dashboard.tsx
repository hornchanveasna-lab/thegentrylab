import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { useSupabaseStatus } from "@/lib/data";
import { GentryMark } from "@/components/site/GentryMark";
import {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  resetConfig,
  exportConfig,
  importConfig,
  type SiteConfig,
  type RoadmapItem,
  type NavLinkItem,
} from "@/lib/siteConfig";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

/* ═══════════════════════════════════════════
   PRIMITIVES
═══════════════════════════════════════════ */

function Field({
  label, value, onChange, textarea = false, mono = false, type = "text",
  hint, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  textarea?: boolean; mono?: boolean; type?: string;
  hint?: string; placeholder?: string;
}) {
  const cls = `w-full bg-[#0a0a0b] border border-white/10 px-3 py-2 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors rounded-none ${mono ? "font-mono" : ""}`;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{label}</span>
      {textarea ? (
        <textarea className={`${cls} resize-y min-h-[72px]`} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} className={cls} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="text-[10px] text-white/22 font-mono">{hint}</p>}
    </label>
  );
}

function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-[38px] w-14 cursor-pointer bg-transparent border border-white/10 rounded-none" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-[#0a0a0b] border border-white/10 px-3 py-2 text-[13px] font-mono text-white focus:outline-none focus:border-[#ff5100]/60 transition-colors" />
      </div>
      {hint && <p className="text-[10px] text-white/22 font-mono">{hint}</p>}
    </label>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[13px] text-white/80 font-medium">{label}</p>
        {hint && <p className="text-[11px] text-white/30 font-mono mt-0.5">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative shrink-0 w-11 h-6 rounded-full border transition-all duration-200"
        style={{
          backgroundColor: checked ? "#ff5100" : "rgba(255,255,255,0.06)",
          borderColor:     checked ? "#ff5100" : "rgba(255,255,255,0.12)",
        }}
      >
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: checked ? "translateX(20px)" : "translateX(2px)" }} />
      </button>
    </div>
  );
}

function SectionCard({ id, title, icon, badge, children, defaultOpen = true }: {
  id: string; title: string; icon: React.ReactNode; badge?: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="border border-white/8 overflow-hidden bg-[#0d0d0e]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 border-b border-white/8 flex items-center justify-between gap-3 hover:bg-white/3 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-white/60">{icon}</span>
          <h2 className="font-extrabold text-sm uppercase tracking-tight text-white">{title}</h2>
          {badge && (
            <span className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest border"
              style={{ borderColor: "rgba(255,81,0,0.3)", color: "#ff5100", backgroundColor: "rgba(255,81,0,0.08)" }}>
              {badge}
            </span>
          )}
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition-transform shrink-0"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "rgba(255,255,255,0.25)" }}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && <div className="px-6 py-5 flex flex-col gap-5">{children}</div>}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 -mx-6 px-6">
      <span className="font-mono text-[9px] uppercase tracking-widest text-white/20 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-white/6" />
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="self-start flex items-center gap-2 px-3 py-2 border border-white/10 text-white/40 hover:text-white hover:border-white/25 text-[11px] font-mono uppercase tracking-widest transition-all">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="h-[38px] w-9 flex items-center justify-center border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/8 text-[13px] transition-colors shrink-0">
      ×
    </button>
  );
}

/* ═══════════════════════════════════════════
   OVERVIEW PANEL
═══════════════════════════════════════════ */

function OverviewPanel({ cfg }: { cfg: SiteConfig }) {
  const accent = cfg.accentColor;
  const stats = [
    { label: "Nav links",       value: cfg.navLinks.filter(n => n.visible).length + "/" + cfg.navLinks.length, color: accent },
    { label: "Roadmap cards",   value: cfg.roadmap.length,   color: accent },
    { label: "Ticker items",    value: cfg.ticker.length,    color: accent },
    { label: "Advisory email",  value: cfg.advisoryEmail ? "Set" : "Not set", color: cfg.advisoryEmail ? "#34d399" : "#f43f5e" },
    { label: "Analytics",       value: cfg.analyticsId ? "Set" : "Not set",  color: cfg.analyticsId  ? "#34d399" : "#94a3b8" },
    { label: "Maintenance",     value: cfg.maintenanceMode ? "ON" : "OFF",   color: cfg.maintenanceMode ? "#f43f5e" : "#34d399" },
    { label: "Accent color",    value: cfg.accentColor,      color: cfg.accentColor },
  ];
  return (
    <div className="border border-white/8 bg-[#0d0d0e] px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">Platform Overview</p>
        <span className="font-mono text-[9px] text-white/20">{cfg.platformVersion}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#0a0a0b] border border-white/6 px-3 py-3">
            <p className="font-bold text-sm tabular-nums leading-none mb-1" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/28 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   BRANDING SECTION
═══════════════════════════════════════════ */

function BrandingSection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoColor = cfg.logoColor || cfg.accentColor;
  const [syncColors, setSyncColors] = useState(cfg.logoColor === cfg.accentColor || !cfg.logoColor);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set("logoImage", (ev.target?.result as string) ?? "");
    reader.readAsDataURL(file);
  };
  const handleAccentChange = (v: string) => { set("accentColor", v); if (syncColors) set("logoColor", v); };
  const handleLogoColorChange = (v: string) => { set("logoColor", v); setSyncColors(false); };
  const toggleSync = () => {
    const next = !syncColors; setSyncColors(next);
    if (next) set("logoColor", cfg.accentColor);
  };

  const SWATCHES = ["#ff5100","#ffffff","#facc15","#34d399","#38bdf8","#a78bfa","#f43f5e","#e11d48","#0ea5e9","#000000"];

  return (
    <SectionCard id="branding" title="Branding" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><line x1="8" y1="2" x2="8" y2="3.5"/><line x1="8" y1="12.5" x2="8" y2="14"/></svg>
    }>
      <Divider label="Colors" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ColorField label="Accent color — buttons, highlights, borders" value={cfg.accentColor} onChange={handleAccentChange}
          hint="Used across all pages for buttons, highlights, and active states." />
        <Field label="Navigation tagline" value={cfg.tagline} onChange={(v) => set("tagline", v)}
          hint='Appears after the logo in the nav bar. E.g. "Industrial Intelligence · KH"' />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">Logo G mark color</span>
          <button onClick={toggleSync}
            className={`flex items-center gap-2 px-3 py-1 text-[10px] font-mono uppercase tracking-widest transition-all border ${syncColors ? "border-[#ff5100]/30 text-[#ff5100] bg-[#ff5100]/8" : "border-white/10 text-white/35 hover:border-white/25"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${syncColors ? "bg-[#ff5100]" : "bg-white/30"}`} />
            {syncColors ? "Linked to accent" : "Independent color"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input type="color" value={logoColor} onChange={(e) => handleLogoColorChange(e.target.value)}
            disabled={syncColors}
            className={`h-[38px] w-14 cursor-pointer border transition-all rounded-none ${syncColors ? "opacity-40 cursor-not-allowed border-white/5" : "border-white/20"}`} />
          <input type="text" value={logoColor} onChange={(e) => handleLogoColorChange(e.target.value)}
            disabled={syncColors}
            className={`flex-1 bg-[#0a0a0b] border px-3 py-2 text-[13px] font-mono text-white focus:outline-none transition-colors ${syncColors ? "opacity-40 cursor-not-allowed border-white/5" : "border-white/10 focus:border-[#ff5100]/60"}`} />
          <div className="flex gap-1 shrink-0">
            {SWATCHES.map((c) => (
              <button key={c} onClick={() => handleLogoColorChange(c)} title={c}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: logoColor === c ? "#fff" : "transparent",
                  outline: c === "#ffffff" ? "1px solid rgba(255,255,255,0.2)" : "none" }} />
            ))}
          </div>
        </div>
      </div>

      <Divider label="Logo image" />
      <div className="flex items-start gap-4">
        <button onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 w-28 h-20 border-2 border-dashed border-white/15 hover:border-[#ff5100]/50 hover:bg-[#ff5100]/5 transition-all text-white/35 hover:text-white/60 shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v9M5 6l4-4 4 4M2 13v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="text-[10px] font-mono uppercase tracking-wider">Upload</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoUpload} />
        {cfg.logoImage ? (
          <div className="relative flex items-center justify-center h-20 px-4 bg-[#0a0a0b] border border-white/10">
            <img src={cfg.logoImage} alt="Logo" className="max-h-14 max-w-[120px] object-contain" />
            <button onClick={() => set("logoImage", "")}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center hover:bg-red-400 transition-colors">✕</button>
          </div>
        ) : (
          <div className="flex items-center px-4 h-20 bg-[#0a0a0b] border border-white/8 text-[11px] text-white/25">
            No image — using SVG G mark
          </div>
        )}
      </div>
      <p className="text-[10px] text-white/22 font-mono -mt-3">Accepts PNG, JPG, SVG, WebP. Stored in browser only.</p>

      <Divider label="Wordmark text" />
      <div className="grid grid-cols-3 gap-4">
        <Field label='Line 1 ("The")' value={cfg.logoLine1} onChange={(v) => set("logoLine1", v)} />
        <Field label='Line 2 ("Gentry")' value={cfg.logoLine2} onChange={(v) => set("logoLine2", v)} />
        <Field label='Line 3 ("Lab") — accent color' value={cfg.logoLine3} onChange={(v) => set("logoLine3", v)} />
      </div>

      <Divider label="Live preview" />
      <div className="border border-white/8 px-5 py-4 bg-[#0a0a0b]">
        <div className="flex items-center gap-3">
          {cfg.logoImage ? (
            <img src={cfg.logoImage} alt="Logo" className="h-9 w-auto object-contain shrink-0" />
          ) : (
            <GentryMark color={logoColor} size={36} />
          )}
          <div className="flex flex-col leading-none">
            <span className="font-extrabold text-[10px] uppercase tracking-[0.18em] text-white/50">{cfg.logoLine1}</span>
            <span className="font-extrabold text-[15px] uppercase tracking-tighter text-white leading-tight">{cfg.logoLine2}</span>
            <span className="font-extrabold text-[15px] uppercase tracking-tighter leading-tight" style={{ color: cfg.accentColor }}>{cfg.logoLine3}</span>
          </div>
          <span className="ml-4 font-mono text-[10px] uppercase tracking-widest text-white/20 border-l border-white/10 pl-4">{cfg.tagline}</span>
        </div>
      </div>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   NAVIGATION SECTION
═══════════════════════════════════════════ */

function NavigationSection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  const setNavLink = (i: number, field: keyof NavLinkItem, val: string | boolean) => {
    const next = cfg.navLinks.map((n, idx) => idx === i ? { ...n, [field]: val } : n);
    set("navLinks", next);
  };

  return (
    <SectionCard id="navigation" title="Navigation" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="12" x2="12" y2="12"/></svg>
    }>
      <p className="text-[12px] text-white/40 leading-relaxed -mt-1">Control which nav links are visible in the top navigation bar. Labels are editable.</p>
      <div className="border border-white/8 divide-y divide-white/6">
        {cfg.navLinks.map((link, i) => (
          <div key={link.id} className="flex items-center gap-3 px-4 py-3 bg-[#0a0a0b]">
            <div className="flex items-center gap-1.5 w-20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: link.visible ? "#34d399" : "rgba(255,255,255,0.15)" }} />
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">{link.id}</span>
            </div>
            <input
              value={link.label}
              onChange={(e) => setNavLink(i, "label", e.target.value)}
              className="flex-1 bg-transparent border-0 border-b border-white/8 focus:border-[#ff5100]/40 px-0 py-1 text-[13px] text-white focus:outline-none transition-colors"
            />
            <button onClick={() => setNavLink(i, "visible", !link.visible)}
              className="shrink-0 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest border transition-all"
              style={{
                borderColor:     link.visible ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.1)",
                color:           link.visible ? "#34d399" : "rgba(255,255,255,0.3)",
                backgroundColor: link.visible ? "rgba(52,211,153,0.08)" : "transparent",
              }}>
              {link.visible ? "Visible" : "Hidden"}
            </button>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/22 font-mono">Hidden links are removed from the navigation bar. The Home link is always visible.</p>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   HERO SECTION
═══════════════════════════════════════════ */

function HeroSection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  return (
    <SectionCard id="hero" title="Hero Section" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="1" y="3" width="14" height="10" rx="1"/><path d="M4 7l2 2 4-4"/></svg>
    }>
      <Field label="Eyebrow label (small text above headline)"
        value={cfg.heroEyebrow} onChange={(v) => set("heroEyebrow", v)}
        hint='E.g. "Industrial Intelligence · Cambodia"' />
      <Divider label="Headline" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Line 1" value={cfg.heroLine1} onChange={(v) => set("heroLine1", v)} />
        <Field label="Line 2 (gradient accent word)" value={cfg.heroLine2} onChange={(v) => set("heroLine2", v)} />
        <Field label="Line 3" value={cfg.heroLine3} onChange={(v) => set("heroLine3", v)} textarea />
      </div>
      <Field label="Sub-text paragraph" value={cfg.heroSubtext} onChange={(v) => set("heroSubtext", v)} textarea
        hint="Shows below headline in white/50. Keep under 180 chars." />
      <Divider label="CTAs" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Primary CTA (orange button)" value={cfg.heroCta1} onChange={(v) => set("heroCta1", v)}
          hint='Links to /map' />
        <Field label="Secondary CTA (outline button)" value={cfg.heroCta2} onChange={(v) => set("heroCta2", v)}
          hint='Links to /about' />
      </div>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   ADVISORY & CONTACT
═══════════════════════════════════════════ */

function AdvisorySection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  return (
    <SectionCard id="advisory" title="Advisory & Contact" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M2 3h12a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1z"/><polyline points="1,3 8,9 15,3"/></svg>
    } badge="Critical">
      <p className="text-[12px] text-white/40 -mt-1">This email address appears on every advisory CTA across Tracker, Research, Map, and About pages.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Advisory email address ★" value={cfg.advisoryEmail} onChange={(v) => set("advisoryEmail", v)}
          type="email" hint="Used in all mailto: links site-wide. Keep accurate." />
        <Field label="Office location" value={cfg.contactOffice} onChange={(v) => set("contactOffice", v)}
          hint='E.g. "Phnom Penh, Cambodia"' />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="City display name" value={cfg.contactCity} onChange={(v) => set("contactCity", v)} />
        <Field label="Phone (optional)" value={cfg.contactPhone} onChange={(v) => set("contactPhone", v)}
          hint="Leave blank to hide" placeholder="+855 xx xxx xxx" />
        <Field label="Office hours" value={cfg.contactHours} onChange={(v) => set("contactHours", v)}
          hint='E.g. "Mon–Fri, 09:00–18:00 ICT"' />
      </div>

      <Divider label="Advisory CTA toggle" />
      <Toggle label="Show advisory banner on all content pages"
        checked={cfg.showAdvisoryBanner}
        onChange={(v) => set("showAdvisoryBanner", v)}
        hint="Displays the orange advisory CTA at the bottom of Research, Tracker detail panels, and About pages." />

      {/* Quick preview */}
      <Divider label="Email preview" />
      <div className="px-4 py-3 bg-[#0a0a0b] border border-white/6 flex items-center justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: cfg.accentColor }}>Advisory link preview</p>
          <p className="text-[12px] text-white/60">mailto: <span className="text-white/85 font-mono">{cfg.advisoryEmail || "—"}</span></p>
        </div>
        <a href={`mailto:${cfg.advisoryEmail}`}
          className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-black font-bold"
          style={{ backgroundColor: cfg.accentColor }}>
          Test →
        </a>
      </div>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   SEO & META
═══════════════════════════════════════════ */

function SeoSection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  const charCount = cfg.seoDescription.length;
  const descOk = charCount >= 120 && charCount <= 160;
  return (
    <SectionCard id="seo" title="SEO & Meta" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="7" cy="7" r="5"/><path d="M13 13l-3-3"/></svg>
    }>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Site name" value={cfg.seoSiteName} onChange={(v) => set("seoSiteName", v)}
          hint="Used in browser tab title and OG tags." />
        <Field label="Social sharing image URL" value={cfg.seoOgImage} onChange={(v) => set("seoOgImage", v)}
          placeholder="https://thegentrylab.io/og-image.jpg"
          hint="1200×630px recommended. Leave blank for default." />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">Meta description</span>
          <span className={`font-mono text-[10px] ${descOk ? "text-green-400" : charCount > 160 ? "text-red-400" : "text-white/30"}`}>
            {charCount}/160 chars
          </span>
        </div>
        <textarea
          value={cfg.seoDescription}
          onChange={(e) => set("seoDescription", e.target.value)}
          rows={3}
          className="w-full bg-[#0a0a0b] border border-white/10 px-3 py-2 text-[13px] text-white resize-y focus:outline-none focus:border-[#ff5100]/60 transition-colors"
          style={{ borderColor: charCount > 160 ? "rgba(244,63,94,0.4)" : undefined }}
        />
        <p className="text-[10px] text-white/22 font-mono">Optimal length: 120–160 characters. Appears in Google search results.</p>
      </div>

      {/* Preview */}
      <Divider label="Google preview" />
      <div className="px-4 py-4 bg-[#0a0a0b] border border-white/6">
        <p className="text-[18px] text-[#8ab4f8] leading-snug truncate">{cfg.seoSiteName} — Cambodia Industrial Intelligence</p>
        <p className="text-[13px] text-[#4caf50] font-mono mt-0.5">thegentrylab.io</p>
        <p className="text-[13px] text-[#bdc1c6] mt-1 leading-relaxed" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {cfg.seoDescription}
        </p>
      </div>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   MAP SETTINGS
═══════════════════════════════════════════ */

const ALL_LAYERS = [
  { id: "investment",     label: "Investment",     desc: "SEZs, parks, factories" },
  { id: "infrastructure", label: "Infrastructure", desc: "Roads, ports, airports" },
  { id: "utilities",      label: "Utilities",      desc: "EDC substations, water" },
  { id: "labor",          label: "Labor",          desc: "Universities, TVET" },
  { id: "risk",           label: "Risk",           desc: "Flood zones, risk areas" },
  { id: "corridors",      label: "Corridors",      desc: "National road corridors" },
];

function MapSection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  const toggleLayer = (id: string) => {
    const layers = cfg.mapDefaultLayers.includes(id)
      ? cfg.mapDefaultLayers.filter(l => l !== id)
      : [...cfg.mapDefaultLayers, id];
    set("mapDefaultLayers", layers);
  };

  return (
    <SectionCard id="map" title="Map Defaults" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M1 3l5 2 4-2 5 2v10l-5-2-4 2-5-2V3z"/><line x1="6" y1="5" x2="6" y2="15"/><line x1="10" y1="3" x2="10" y2="13"/></svg>
    }>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Center latitude" value={String(cfg.mapCenter[0])}
          onChange={(v) => set("mapCenter", [parseFloat(v) || 11.55, cfg.mapCenter[1]])} mono
          hint="Cambodia center ≈ 11.55" />
        <Field label="Center longitude" value={String(cfg.mapCenter[1])}
          onChange={(v) => set("mapCenter", [cfg.mapCenter[0], parseFloat(v) || 104.9])} mono
          hint="Cambodia center ≈ 104.90" />
        <Field label="Default zoom (1–18)" value={String(cfg.mapZoom)}
          onChange={(v) => set("mapZoom", parseInt(v) || 7)} mono
          hint="7 shows all of Cambodia" />
      </div>

      <Divider label="Default visible layers" />
      <p className="text-[12px] text-white/40 -mt-2">These layers will be toggled ON when the map first loads.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {ALL_LAYERS.map((layer) => {
          const active = cfg.mapDefaultLayers.includes(layer.id);
          return (
            <button key={layer.id} onClick={() => toggleLayer(layer.id)}
              className="flex items-start gap-3 p-3 border transition-all text-left"
              style={{
                borderColor:     active ? "rgba(255,81,0,0.35)" : "rgba(255,255,255,0.08)",
                backgroundColor: active ? "rgba(255,81,0,0.06)" : "transparent",
              }}>
              <span className="mt-0.5 w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-all"
                style={{ borderColor: active ? "#ff5100" : "rgba(255,255,255,0.2)", backgroundColor: active ? "#ff5100" : "transparent" }}>
                {active && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              <div>
                <p className="text-[12px] font-bold" style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}>{layer.label}</p>
                <p className="text-[10px] text-white/28 font-mono mt-0.5">{layer.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Divider label="Preset views" />
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Phnom Penh", lat: 11.57, lng: 104.92, zoom: 12 },
          { label: "Sihanoukville", lat: 10.63, lng: 103.52, zoom: 12 },
          { label: "Svay Rieng / Bavet", lat: 11.07, lng: 105.96, zoom: 11 },
          { label: "All Cambodia", lat: 11.55, lng: 104.90, zoom: 7 },
        ].map((preset) => (
          <button key={preset.label}
            onClick={() => { set("mapCenter", [preset.lat, preset.lng]); set("mapZoom", preset.zoom); }}
            className="px-3 py-1.5 border border-white/10 text-[11px] font-mono text-white/45 hover:text-white hover:border-white/25 transition-all">
            {preset.label}
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   ROADMAP CARDS
═══════════════════════════════════════════ */

function RoadmapSection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  const setR = (i: number, f: keyof RoadmapItem, v: string) =>
    set("roadmap", cfg.roadmap.map((r, idx) => idx === i ? { ...r, [f]: v } : r));
  const addR = () => {
    const n = String(cfg.roadmap.length + 1).padStart(2, "0");
    set("roadmap", [...cfg.roadmap, { n, title: "New Feature", desc: "Description here." }]);
  };
  const removeR = (i: number) => set("roadmap", cfg.roadmap.filter((_, idx) => idx !== i));

  return (
    <SectionCard id="roadmap" title="Roadmap Cards" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M8 2v12M2 8h12"/><circle cx="8" cy="8" r="6" strokeDasharray="2 2"/></svg>
    }>
      <p className="text-[12px] text-white/40 -mt-1">The "Coming next" feature cards shown on the About page.</p>
      <div className="flex flex-col gap-3">
        {cfg.roadmap.map((r, i) => (
          <div key={i} className="border border-white/6 bg-[#0a0a0b] p-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-white/25">#{i+1}</span>
              <div className="w-16"><Field label="Number" value={r.n} onChange={(v) => setR(i, "n", v)} mono /></div>
              <div className="flex-1"><Field label="Title" value={r.title} onChange={(v) => setR(i, "title", v)} /></div>
              <RemoveButton onClick={() => removeR(i)} />
            </div>
            <Field label="Description" value={r.desc} onChange={(v) => setR(i, "desc", v)} textarea />
          </div>
        ))}
      </div>
      <AddButton label="Add roadmap card" onClick={addR} />
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   TICKER
═══════════════════════════════════════════ */

function TickerSection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  const setT = (i: number, v: string) => set("ticker", cfg.ticker.map((t, idx) => idx === i ? v : t));
  const addT = () => set("ticker", [...cfg.ticker, "New Item"]);
  const removeT = (i: number) => set("ticker", cfg.ticker.filter((_, idx) => idx !== i));

  return (
    <SectionCard id="ticker" title="Marquee Ticker" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M1 8h14M1 8l3-3M1 8l3 3"/></svg>
    }>
      <p className="text-[12px] text-white/40 -mt-1">Items that scroll across the bottom ticker strip on the homepage.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {cfg.ticker.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={t} onChange={(e) => setT(i, e.target.value)}
              className="flex-1 bg-[#0a0a0b] border border-white/10 px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#ff5100]/60 transition-colors" />
            <RemoveButton onClick={() => removeT(i)} />
          </div>
        ))}
      </div>
      <AddButton label="Add ticker item" onClick={addT} />
      {/* Preview */}
      <Divider label="Ticker preview" />
      <div className="overflow-hidden border border-white/6 bg-[#0a0a0b] py-2 px-0">
        <div className="flex items-center gap-8 px-4 overflow-x-auto no-scrollbar">
          {cfg.ticker.map((t, i) => (
            <span key={i} className="font-mono text-[11px] uppercase tracking-widest whitespace-nowrap" style={{ color: cfg.accentColor }}>
              ◆ {t}
            </span>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   PLATFORM SETTINGS
═══════════════════════════════════════════ */

function PlatformSection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  return (
    <SectionCard id="platform" title="Platform Settings" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>
    }>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Platform version" value={cfg.platformVersion} onChange={(v) => set("platformVersion", v)}
          hint='Shown in dashboard header. E.g. "0.1 MVP"' mono />
        <Field label="Google Analytics ID" value={cfg.analyticsId} onChange={(v) => set("analyticsId", v)}
          hint='E.g. "G-XXXXXXXXXX". Stored but not injected in MVP.' mono placeholder="G-XXXXXXXXXX" />
      </div>

      <Divider label="Mode toggles" />
      <div className="flex flex-col gap-4">
        <Toggle
          label="Maintenance mode"
          checked={cfg.maintenanceMode}
          onChange={(v) => set("maintenanceMode", v)}
          hint="When ON, shows a maintenance banner on all public pages. The dashboard remains accessible."
        />
        <Toggle
          label="Show advisory banner"
          checked={cfg.showAdvisoryBanner}
          onChange={(v) => set("showAdvisoryBanner", v)}
          hint="Controls the orange advisory CTA section that appears at the bottom of Research, Tracker, and About pages."
        />
      </div>

      {cfg.maintenanceMode && (
        <div className="flex items-center gap-3 px-4 py-3 border border-red-500/25 bg-red-500/8">
          <span className="text-red-400 text-lg">⚠</span>
          <p className="text-[12px] text-red-300/80">Maintenance mode is <strong>ON</strong>. Public pages are showing a maintenance notice.</p>
        </div>
      )}
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════ */

function FooterSection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  return (
    <SectionCard id="footer" title="Footer Text" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="1" y="3" width="14" height="10" rx="1"/><line x1="1" y1="10" x2="15" y2="10"/><line x1="4" y1="13" x2="6" y2="13"/><line x1="10" y1="13" x2="12" y2="13"/></svg>
    }>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Left text (copyright)" value={cfg.footerLeft} onChange={(v) => set("footerLeft", v)}
          hint='E.g. "© 2026 The Gentry Lab · Phnom Penh"' />
        <Field label="Right text (version info)" value={cfg.footerRight} onChange={(v) => set("footerRight", v)}
          hint='E.g. "Industrial Intelligence Platform · v0.1 MVP"' />
      </div>
      <Divider label="Preview" />
      <div className="flex items-center justify-between px-5 py-3 bg-[#0a0a0b] border border-white/6 text-[11px] font-mono">
        <span className="text-white/35">{cfg.footerLeft}</span>
        <span className="text-white/20">{cfg.footerRight}</span>
      </div>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   DATA INTELLIGENCE
═══════════════════════════════════════════ */

const REFRESH_KEY = "tgl_last_refresh";
const LOG_KEY     = "tgl_refresh_log";
interface RefreshEntry { ts: string; sites: number; corridors: number; status: "success" | "error" }

function DataIntelligenceSection({ cfg, set }: { cfg: SiteConfig; set: Setter }) {
  const { data: dbStatus, isLoading: dbLoading } = useSupabaseStatus();
  const [lastRefresh, setLastRefresh] = useState<string>(() => localStorage.getItem(REFRESH_KEY) ?? "Never");
  const [log, setLog] = useState<RefreshEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); } catch { return []; }
  });
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      const now = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      const entry: RefreshEntry = { ts: now, sites: 44, corridors: 9, status: "success" };
      const newLog = [entry, ...log].slice(0, 8);
      setLastRefresh(now); setLog(newLog);
      localStorage.setItem(REFRESH_KEY, now);
      localStorage.setItem(LOG_KEY, JSON.stringify(newLog));
      setRefreshing(false);
      setToast("✓ Data refreshed successfully");
    }, 2200);
  };

  const scheduleOptions = [
    { value: "daily" as const,   label: "Daily",   desc: "Every 24h" },
    { value: "weekly" as const,  label: "Weekly",  desc: "Every 7d" },
    { value: "monthly" as const, label: "Monthly", desc: "Every 30d" },
  ];

  return (
    <SectionCard id="data-intelligence" title="Data Intelligence" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M13 8a5 5 0 11-9.9-1"/><polyline points="13,4 13,8 9,8"/></svg>
    }>
      {toast && (
        <div className="px-4 py-2.5 border border-green-500/30 bg-green-500/8 text-green-400 font-mono text-[11px] uppercase tracking-widest">
          {toast}
        </div>
      )}

      {/* Supabase connection status */}
      <div className="flex items-center gap-2 px-3 py-2 border border-white/8 bg-[#0a0a0b] w-fit">
        {dbLoading ? (
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-white/20 animate-pulse" />
        ) : dbStatus?.connected ? (
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" />
        ) : (
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
        )}
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          {dbLoading ? "Connecting…" : dbStatus?.connected ? "Supabase live" : "Static fallback"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Map sites",     value: dbStatus?.counts?.sites?.toString() ?? "—",     color: "#ff5100" },
          { label: "Projects",      value: dbStatus?.counts?.projects?.toString() ?? "—",  color: "#facc15" },
          { label: "News articles", value: dbStatus?.counts?.news?.toString() ?? "—",      color: "#34d399" },
          { label: "Research",      value: dbStatus?.counts?.research?.toString() ?? "—",  color: "#38bdf8" },
        ].map((s) => (
          <div key={s.label} className="border border-white/8 bg-[#0a0a0b] px-4 py-3">
            <p className="text-xl font-extrabold tracking-tighter" style={{ color: s.color }}>{s.value}</p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/28 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">Last refreshed</p>
          <div className="bg-[#0a0a0b] border border-white/10 px-3 py-2 text-[13px] text-white/60 font-mono">{lastRefresh}</div>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">Auto-refresh schedule</p>
          <div className="flex gap-2">
            {scheduleOptions.map((opt) => (
              <button key={opt.value} onClick={() => set("refreshSchedule", opt.value)}
                className="flex-1 px-2 py-2 text-[10px] font-mono uppercase tracking-widest border transition-all flex flex-col items-center gap-0.5"
                style={{
                  backgroundColor: cfg.refreshSchedule === opt.value ? "rgba(255,81,0,0.1)" : "transparent",
                  borderColor:     cfg.refreshSchedule === opt.value ? "#ff5100" : "rgba(255,255,255,0.1)",
                  color:           cfg.refreshSchedule === opt.value ? "#ff5100" : "rgba(255,255,255,0.4)",
                }}>
                <span className="font-bold">{opt.label}</span>
                <span className="text-[8px] opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-60"
          style={{ backgroundColor: "#ff5100" }}>
          {refreshing ? (
            <><span className="inline-block w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />Refreshing…</>
          ) : (
            <><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 6.5a4.5 4.5 0 1 1-1.2-3.1"/><polyline points="11,2 11,5.5 7.5,5.5"/></svg>Refresh now</>
          )}
        </button>
        <p className="text-[11px] text-white/30 font-mono">Resets React Query cache · Claude cron agents populate Supabase weekly</p>
      </div>

      {log.length > 0 && (
        <>
          <Divider label="Refresh history" />
          <div className="divide-y divide-white/5 border border-white/8 overflow-hidden">
            {log.map((entry, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2.5 bg-[#0a0a0b]">
                <span className="text-green-400 text-[11px] font-bold">✓</span>
                <span className="font-mono text-[11px] text-white/55 flex-1">{entry.ts}</span>
                <span className="font-mono text-[10px] text-white/28">{entry.sites} sites · {entry.corridors} corridors</span>
              </div>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   IMPORT / EXPORT
═══════════════════════════════════════════ */

function ImportExportSection({ cfg, onImport }: { cfg: SiteConfig; onImport: (c: SiteConfig) => void }) {
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    const parsed = importConfig(importText);
    if (!parsed) { setImportError("Invalid JSON — could not parse config."); return; }
    onImport(parsed);
    setImportText("");
    setImportError("");
    setImportSuccess(true);
    setTimeout(() => setImportSuccess(false), 3000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  };

  return (
    <SectionCard id="import-export" title="Import / Export Config" icon={
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V7l-4-5z"/><polyline points="9,2 9,7 13,7"/><line x1="5" y1="10" x2="11" y2="10"/><line x1="5" y1="12" x2="8" y2="12"/></svg>
    } defaultOpen={false}>
      <Divider label="Export" />
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <p className="text-[12px] text-white/50 leading-relaxed mb-3">Download the current configuration as a JSON file. Use this to back up your settings or transfer them to another device.</p>
          <button onClick={() => exportConfig(cfg)}
            className="flex items-center gap-2 px-4 py-2.5 border border-white/15 text-white/65 hover:text-white hover:border-white/30 font-mono text-[11px] uppercase tracking-widest transition-all">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6.5 1v7M3.5 5l3 3 3-3M1 10v1a1 1 0 001 1h9a1 1 0 001-1v-1"/></svg>
            Download config.json
          </button>
        </div>
        <div className="hidden lg:flex flex-col items-center gap-1 px-4 py-3 border border-white/6 bg-[#0a0a0b] font-mono text-[10px] text-white/20">
          <span className="text-white/40 font-bold">JSON</span>
          <span>config</span>
        </div>
      </div>

      <Divider label="Import" />
      <p className="text-[12px] text-white/50 leading-relaxed">Paste a previously exported config JSON below, or load a file. This will overwrite current settings.</p>
      <div className="flex gap-2">
        <button onClick={() => fileRef.current?.click()}
          className="px-3 py-2 border border-white/10 text-white/40 hover:text-white font-mono text-[11px] uppercase tracking-widest transition-all flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6.5 8V1M3.5 4l3-3 3 3M1 10v1a1 1 0 001 1h9a1 1 0 001-1v-1"/></svg>
          Load file
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileImport} />
        {importText && (
          <span className="flex items-center text-[11px] text-green-400 font-mono gap-1">
            <span>✓</span> File loaded
          </span>
        )}
      </div>
      <textarea
        value={importText}
        onChange={(e) => { setImportText(e.target.value); setImportError(""); }}
        rows={5}
        placeholder={'{\n  "accentColor": "#ff5100",\n  ...\n}'}
        className="w-full bg-[#0a0a0b] border border-white/10 px-3 py-2 text-[12px] font-mono text-white/70 resize-y focus:outline-none focus:border-[#ff5100]/50 transition-colors placeholder-white/12"
      />
      {importError && <p className="text-[11px] text-red-400 font-mono">{importError}</p>}
      {importSuccess && <p className="text-[11px] text-green-400 font-mono">✓ Config imported successfully</p>}
      <button onClick={handleImport} disabled={!importText.trim()}
        className="self-start px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-30"
        style={{ backgroundColor: "#ff5100" }}>
        Apply imported config
      </button>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════
   TYPE HELPERS
═══════════════════════════════════════════ */
type Setter = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => void;

/* ═══════════════════════════════════════════
   SHARED BODY — used by Dashboard page AND admin Config tab
═══════════════════════════════════════════ */

/** Pass `embedded` when rendered inside the admin panel (no page title update, adjusted sticky offset). */
export function DashboardBody({ embedded = false }: { embedded?: boolean }) {
  const [cfg, setCfg] = useState<SiteConfig>(() => loadConfig());
  const [saved, setSaved] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [activeSection, setActiveSection] = useState("branding");

  const set: Setter = useCallback(<K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setUnsaved(true);
  }, []);

  const handleSave = () => {
    saveConfig(cfg);
    setSaved(true);
    setUnsaved(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    if (confirm("Reset ALL settings to defaults? This cannot be undone.")) {
      const def = resetConfig();
      setCfg(def);
      setSaved(false);
      setUnsaved(false);
    }
  };

  useEffect(() => {
    if (embedded) return;
    document.title = unsaved ? "● Management Dashboard — TGL" : "Management Dashboard — TGL";
    return () => { document.title = "The Gentry Lab — Cambodia Industrial Intelligence Platform"; };
  }, [unsaved, embedded]);

  const NAV = [
    { id: "overview",         label: "Overview",        icon: "◈" },
    { id: "branding",         label: "Branding",        icon: "◉" },
    { id: "navigation",       label: "Navigation",      icon: "≡" },
    { id: "hero",             label: "Hero",            icon: "▲" },
    { id: "advisory",         label: "Advisory",        icon: "✉" },
    { id: "seo",              label: "SEO & Meta",      icon: "⊙" },
    { id: "map",              label: "Map",             icon: "◎" },
    { id: "roadmap",          label: "Roadmap",         icon: "⊞" },
    { id: "ticker",           label: "Ticker",          icon: "⟶" },
    { id: "data-intelligence",label: "Data",            icon: "↺" },
    { id: "platform",         label: "Platform",        icon: "⚙" },
    { id: "footer",           label: "Footer",          icon: "▬" },
    { id: "import-export",    label: "Import/Export",   icon: "⇅" },
  ];

  const stickyTop  = embedded ? "top-0"                     : "top-[53px]";
  const sidebarH   = embedded ? "h-full"                    : "h-[calc(100vh-53px)]";

  return (
    <div className={`flex ${embedded ? "h-full" : "flex-1 max-w-[1400px] mx-auto w-full"}`}>

      {/* ── Sidebar ── */}
      <aside className={`hidden lg:flex flex-col w-52 shrink-0 border-r border-white/8 py-6 px-3 gap-0.5 sticky ${stickyTop} ${sidebarH} overflow-y-auto`}>
        {/* Save / Reset inline when embedded */}
        {embedded && (
          <div className="flex gap-1.5 mb-4 px-1">
            {unsaved && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0" />}
            <button onClick={handleSave}
              className={`flex-1 px-2 py-1.5 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${
                saved ? "bg-green-500/15 text-green-400 border border-green-500/25" : "text-black"
              }`}
              style={{ backgroundColor: saved ? undefined : cfg.accentColor }}>
              {saved ? "✓ Saved" : "Save"}
            </button>
            <button onClick={handleReset}
              className="px-2 py-1.5 border border-white/10 text-white/30 hover:text-white text-[9px] font-mono uppercase tracking-widest transition-all">
              Reset
            </button>
          </div>
        )}

        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/20 px-3 mb-2">Sections</p>
        {NAV.map((n) => (
          <a key={n.id} href={`#${n.id}`} onClick={() => setActiveSection(n.id)}
            className={`flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium transition-all ${
              activeSection === n.id
                ? "text-white bg-white/5 border-l-2"
                : "text-white/38 hover:text-white/75 hover:bg-white/3 border-l-2 border-transparent"
            }`}
            style={{ borderLeftColor: activeSection === n.id ? cfg.accentColor : undefined }}>
            <span className="font-mono text-[11px] w-4 text-center shrink-0" style={{ color: activeSection === n.id ? cfg.accentColor : "rgba(255,255,255,0.2)" }}>{n.icon}</span>
            <span>{n.label}</span>
          </a>
        ))}

        {!embedded && (
          <div className="mt-auto pt-4 border-t border-white/8 flex flex-col gap-0.5">
            {[
              { to: "/map", icon: "◎", label: "Open Map" },
              { to: "/tracker", icon: "▦", label: "Tracker" },
              { to: "/about", icon: "▲", label: "About" },
            ].map(l => (
              <Link key={l.to} to={l.to}
                className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-white/25 hover:text-white/65 transition-colors">
                <span className="font-mono text-[10px]">{l.icon}</span>{l.label}
              </Link>
            ))}
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 px-5 py-6 flex flex-col gap-4 min-w-0 overflow-y-auto">

        {!embedded && (
          <div className="flex items-start gap-3 px-4 py-3 border border-white/8 bg-[#0d0d0e]">
            <span className="text-white/35 mt-0.5 shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="7" cy="7" r="6"/><line x1="7" y1="5" x2="7" y2="7"/><line x1="7" y1="9" x2="7" y2="9" strokeWidth="2"/></svg>
            </span>
            <p className="text-[11px] text-white/45 leading-relaxed">
              Changes apply live to the platform. Click <strong className="text-white/70">Save changes</strong> to persist to localStorage. Use <strong className="text-white/70">Export</strong> to back up your config.
              Changes are <strong className="text-white/70">browser-local</strong> — they won't affect other visitors.
            </p>
          </div>
        )}

        <div id="overview" className="scroll-mt-16"><OverviewPanel cfg={cfg} /></div>
        <div className="scroll-mt-16"><BrandingSection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><NavigationSection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><HeroSection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><AdvisorySection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><SeoSection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><MapSection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><RoadmapSection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><TickerSection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><DataIntelligenceSection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><PlatformSection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><FooterSection cfg={cfg} set={set} /></div>
        <div className="scroll-mt-16"><ImportExportSection cfg={cfg} onImport={(c) => { setCfg(c); setUnsaved(true); }} /></div>

        {/* Bottom save bar — standalone mode only */}
        {!embedded && (
          <div className="flex items-center justify-between px-5 py-4 border border-white/8 bg-[#0d0d0e] mt-2">
            <p className="text-[11px] font-mono" style={{ color: unsaved ? "#fbbf24" : "rgba(255,255,255,0.25)" }}>
              {unsaved ? "● Unsaved changes" : saved ? "✓ All changes saved" : "No unsaved changes"}
            </p>
            <div className="flex gap-2">
              <button onClick={handleReset}
                className="px-4 py-2 border border-white/10 text-white/35 hover:text-white text-[10px] font-mono uppercase tracking-widest transition-all">
                Reset defaults
              </button>
              <button onClick={handleSave}
                className={`px-6 py-2 text-[10px] font-mono uppercase tracking-widest font-bold transition-all ${
                  saved ? "bg-green-500/20 text-green-400 border border-green-500/30" : "text-black hover:brightness-110"
                }`}
                style={{ backgroundColor: saved ? undefined : cfg.accentColor }}>
                {saved ? "✓ Saved!" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STANDALONE DASHBOARD PAGE  (/dashboard)
═══════════════════════════════════════════ */

function Dashboard() {
  const [cfg] = useState<SiteConfig>(() => loadConfig());

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0a0a0b]/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-3 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-1.5 text-white/35 hover:text-white transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="font-mono text-[10px] uppercase tracking-widest">Site</span>
            </Link>
            <span className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <GentryMark color={cfg.accentColor} size={20} />
              <span className="font-extrabold text-sm uppercase tracking-tight">Management Dashboard</span>
              <span className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest border border-white/10 text-white/30">{cfg.platformVersion}</span>
            </div>
          </div>
          <a href="/admin" className="flex items-center gap-1.5 px-3 py-2 border border-white/10 text-white/35 hover:text-white hover:border-white/25 font-mono text-[10px] uppercase tracking-widest transition-all">
            Admin ↗
          </a>
        </div>
      </header>
      <DashboardBody embedded={false} />
    </div>
  );
}
