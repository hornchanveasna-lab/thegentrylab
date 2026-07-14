import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { supabaseCM } from "@/lib/supabase-cm";
import { useCMLang } from "@/lib/cm-i18n";
import {
  useCMProjects,
  createCMProject,
  useCMProjectFavorites,
  setCMProjectFavorite,
  useCMAccountSettings,
  upsertCMAccountSettings,
  CM_PROJECT_SECTORS,
  type CMProject,
  type ProjectStatus,
  type ProjectHealth,
  type ProjectSector,
} from "@/lib/cm-data";
import { FieldSelect, Sheet, FAB, PROJECT_STATUS_OPTIONS, PROJECT_STATUS_COLOR, PROJECT_HEALTH_OPTIONS, PROJECT_HEALTH_COLOR } from "@/components/cm/shared";

export const Route = createFileRoute("/cm/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — Construction Management App" },
      { name: "description", content: "Your construction projects — site diaries, punch lists, and photo logs." },
    ],
  }),
  component: CMProjectsPage,
});

const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";
const chipCls = "px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-widest transition-colors";

type SortKey = "updated" | "name" | "start" | "end" | "value" | "health";
const HEALTH_RANK: Record<ProjectHealth, number> = { Red: 0, Amber: 1, Green: 2 };

type SummaryKey = "all" | "Active" | "Planning" | "On Hold" | "Delayed" | "Completed" | "atRisk" | "Archived";
const SUMMARY_CARDS: SummaryKey[] = ["all", "Active", "Planning", "On Hold", "Delayed", "Completed", "atRisk", "Archived"];

function matchesSummary(p: CMProject, key: SummaryKey): boolean {
  if (key === "all") return true;
  if (key === "atRisk") return p.health === "Red";
  return p.status === key;
}

function BackButton() {
  return (
    <Link to="/cm" className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3L5 8l5 5" />
      </svg>
    </Link>
  );
}

function formatContractValue(value: number | null, currency: string | null): string | null {
  if (value == null) return null;
  const amount = value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(0)}K` : `${value}`;
  return currency ? `${currency} ${amount}` : amount;
}

function NewProjectSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (p: CMProject) => void }) {
  const { user } = useAuthCM();
  const { t } = useCMLang();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Active");
  const [sector, setSector] = useState<ProjectSector | "">("");
  const [contractValue, setContractValue] = useState("");
  const [currency, setCurrency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const project = await createCMProject(user.id, {
        name: name.trim(),
        client: client.trim() || null,
        location: location.trim() || null,
        status,
        sector: sector || null,
        contract_value: contractValue.trim() ? Number(contractValue) : null,
        currency: currency.trim() || null,
        start_date: startDate || null,
        target_end_date: targetEndDate || null,
        description: description.trim() || null,
      });
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("projects.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("projects.name")}</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("projects.namePlaceholder")} required autoFocus disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projects.client")}</span>
            <input className={inputCls} value={client} onChange={(e) => setClient(e.target.value)} placeholder={t("projects.clientPlaceholder")} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projects.location")}</span>
            <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("projects.locationPlaceholder")} disabled={saving} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projects.status")}</span>
            <FieldSelect value={status} onChange={setStatus} disabled={saving} options={PROJECT_STATUS_OPTIONS.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projects.sector")}</span>
            <FieldSelect value={sector} onChange={setSector} disabled={saving} placeholder={t("projects.sectorPlaceholder")}
              options={[{ value: "", label: t("projects.sectorPlaceholder") }, ...CM_PROJECT_SECTORS.map((s) => ({ value: s, label: t(`sector.${s}`) }))]} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projects.contractValue")}</span>
            <input type="number" min="0" step="any" className={inputCls} value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder="0" disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projects.currency")}</span>
            <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" disabled={saving} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projects.start")}</span>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projects.finish")}</span>
            <input type="date" className={inputCls} value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} disabled={saving} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("projects.description")}</span>
          <textarea className={`${inputCls} resize-y min-h-[72px]`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("projects.descriptionPlaceholder")} disabled={saving} />
        </label>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !name.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("projects.creating") : t("projects.create")}
        </button>
      </form>
    </Sheet>
  );
}

function FavoriteButton({ active, onToggle, className }: { active: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      aria-label="Favorite"
      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${active ? "text-[#ff5100]" : "text-white/25 hover:text-white/50"} ${className ?? ""}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}

function ProjectCard({ project, favorite, onToggleFavorite, t }: {
  project: CMProject; favorite: boolean; onToggleFavorite: () => void; t: (key: string, vars?: Record<string, string>) => string;
}) {
  const sc = PROJECT_STATUS_COLOR[project.status];
  const hc = PROJECT_HEALTH_COLOR[project.health];
  const value = formatContractValue(project.contract_value, project.currency);
  return (
    <Link to="/cm/$projectId" params={{ projectId: project.id }}
      className="block rounded-2xl bg-[#0d0d0e] active:scale-[0.98] hover:bg-[#111113] transition-all p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-extrabold text-[15px] tracking-tight text-white leading-tight truncate">{project.name}</h3>
          {project.project_code && <p className="font-mono text-[10px] text-white/25 mt-0.5">{project.project_code}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <FavoriteButton active={favorite} onToggle={onToggleFavorite} />
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hc }} title={t(`health.${project.health}`)} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${sc}15` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc }} />
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: sc }}>{t(`status.${project.status}`)}</span>
        </span>
        {project.sector && (
          <span className="px-2.5 py-1 rounded-full bg-white/5 font-mono text-[9px] uppercase tracking-widest text-white/40">{t(`sector.${project.sector}`)}</span>
        )}
      </div>
      {project.client && <p className="text-[12px] text-white/45 mb-1">{t("projects.clientLabel")} <span className="text-white/70">{project.client}</span></p>}
      {project.location && (
        <p className="text-[12px] text-white/45 flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {project.location}
        </p>
      )}
      <div className="flex items-center justify-between mt-3">
        {(project.start_date || project.target_end_date) && (
          <p className="font-mono text-[10px] text-white/25 uppercase tracking-widest">
            {project.start_date ?? "—"} → {project.target_end_date ?? "—"}
          </p>
        )}
        {value && <p className="font-mono text-[10px] text-white/35 uppercase tracking-widest ml-auto">{value}</p>}
      </div>
    </Link>
  );
}

function ProjectRow({ project, favorite, onToggleFavorite, t }: {
  project: CMProject; favorite: boolean; onToggleFavorite: () => void; t: (key: string, vars?: Record<string, string>) => string;
}) {
  const sc = PROJECT_STATUS_COLOR[project.status];
  const hc = PROJECT_HEALTH_COLOR[project.health];
  return (
    <Link to="/cm/$projectId" params={{ projectId: project.id }}
      className="flex items-center gap-3 rounded-xl bg-[#0d0d0e] hover:bg-[#111113] transition-colors px-4 py-3">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hc }} title={t(`health.${project.health}`)} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-white truncate">{project.name}</p>
        <p className="text-[11px] text-white/35 truncate">
          {project.project_code && <span className="font-mono">{project.project_code} · </span>}
          {project.client ?? t("projects.noClient")}
        </p>
      </div>
      <p className="hidden sm:block text-[11px] text-white/45 w-32 truncate shrink-0">{project.location ?? "—"}</p>
      <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: `${sc}15` }}>
        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: sc }}>{t(`status.${project.status}`)}</span>
      </span>
      <FavoriteButton active={favorite} onToggle={onToggleFavorite} className="shrink-0" />
    </Link>
  );
}

function FilterSheet({ statuses, healths, sectors, favoritesOnly, onChange, onClose, t }: {
  statuses: Set<ProjectStatus>; healths: Set<ProjectHealth>; sectors: Set<ProjectSector>; favoritesOnly: boolean;
  onChange: (patch: Partial<{ statuses: Set<ProjectStatus>; healths: Set<ProjectHealth>; sectors: Set<ProjectSector>; favoritesOnly: boolean }>) => void;
  onClose: () => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  };
  const hasAny = statuses.size > 0 || healths.size > 0 || sectors.size > 0 || favoritesOnly;

  return (
    <Sheet title={t("projects.filters")} onClose={onClose}>
      <div className="px-6 pb-8 pt-2 flex flex-col gap-5">
        <div>
          <p className={`${labelCls} mb-2`}>{t("projects.status")}</p>
          <div className="flex flex-wrap gap-2">
            {PROJECT_STATUS_OPTIONS.map((s) => (
              <button key={s} type="button" onClick={() => onChange({ statuses: toggle(statuses, s) })}
                className={chipCls} style={statuses.has(s) ? { backgroundColor: "#ff510022", color: "#ff5100" } : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                {t(`status.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={`${labelCls} mb-2`}>{t("projects.health")}</p>
          <div className="flex flex-wrap gap-2">
            {PROJECT_HEALTH_OPTIONS.map((h) => (
              <button key={h} type="button" onClick={() => onChange({ healths: toggle(healths, h) })}
                className={chipCls} style={healths.has(h) ? { backgroundColor: "#ff510022", color: "#ff5100" } : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                {t(`health.${h}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={`${labelCls} mb-2`}>{t("projects.sector")}</p>
          <div className="flex flex-wrap gap-2">
            {CM_PROJECT_SECTORS.map((s) => (
              <button key={s} type="button" onClick={() => onChange({ sectors: toggle(sectors, s) })}
                className={chipCls} style={sectors.has(s) ? { backgroundColor: "#ff510022", color: "#ff5100" } : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                {t(`sector.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={favoritesOnly} onChange={(e) => onChange({ favoritesOnly: e.target.checked })} className="w-4 h-4 rounded accent-[#ff5100]" />
          <span className="text-[13px] text-white/70">{t("projects.favoritesOnly")}</span>
        </label>
        <div className="flex gap-2">
          <button type="button" disabled={!hasAny}
            onClick={() => onChange({ statuses: new Set(), healths: new Set(), sectors: new Set(), favoritesOnly: false })}
            className="flex-1 py-2.5 rounded-full text-[11px] font-mono uppercase tracking-widest text-white/50 bg-white/5 disabled:opacity-30">
            {t("projects.clearFilters")}
          </button>
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-full text-[11px] font-mono uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>
            {t("projects.applyFilters")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function CMProjectsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: projects, isLoading, error } = useCMProjects(user?.id);
  const { data: favorites } = useCMProjectFavorites(user?.id);
  const { data: account } = useCMAccountSettings(user?.id);
  const [showNew, setShowNew] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("updated");
  const [statuses, setStatuses] = useState<Set<ProjectStatus>>(new Set());
  const [healths, setHealths] = useState<Set<ProjectHealth>>(new Set());
  const [sectors, setSectors] = useState<Set<ProjectSector>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const view = account?.projects_view ?? "card";

  const invalidateFavorites = () => queryClient.invalidateQueries({ queryKey: ["cm_project_favorites", user?.id] });

  const toggleFavorite = (projectId: string) => {
    if (!user) return;
    const isFav = favorites?.has(projectId) ?? false;
    setCMProjectFavorite(user.id, projectId, !isFav).then(invalidateFavorites);
  };

  const setView = (v: "card" | "list") => {
    if (!user) return;
    queryClient.setQueryData(["cm_account_settings", user.id], (cur: typeof account) => (cur ? { ...cur, projects_view: v } : cur));
    upsertCMAccountSettings(user.id, { projects_view: v }).then(() =>
      queryClient.invalidateQueries({ queryKey: ["cm_account_settings", user.id] }),
    );
  };

  const q = search.trim().toLowerCase();
  const searched = useMemo(() => {
    if (!projects) return [];
    if (!q) return projects;
    return projects.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.project_code ?? "").toLowerCase().includes(q) ||
      (p.client ?? "").toLowerCase().includes(q) ||
      (p.location ?? "").toLowerCase().includes(q),
    );
  }, [projects, q]);

  const summaryCounts = useMemo(() => {
    const counts = new Map<SummaryKey, number>();
    for (const key of SUMMARY_CARDS) counts.set(key, searched.filter((p) => matchesSummary(p, key)).length);
    return counts;
  }, [searched]);

  const activeSummary: SummaryKey | null = useMemo(() => {
    if (favoritesOnly || sectors.size > 0) return null;
    if (statuses.size === 0 && healths.size === 0) return "all";
    if (healths.size === 1 && healths.has("Red") && statuses.size === 0) return "atRisk";
    if (statuses.size === 1 && healths.size === 0) return [...statuses][0] as SummaryKey;
    return null;
  }, [statuses, healths, sectors, favoritesOnly]);

  const applySummary = (key: SummaryKey) => {
    if (key === "all") { setStatuses(new Set()); setHealths(new Set()); return; }
    if (key === "atRisk") { setStatuses(new Set()); setHealths(new Set(["Red"])); return; }
    setStatuses(new Set([key as ProjectStatus])); setHealths(new Set());
  };

  const filtered = useMemo(() => {
    let list = searched;
    if (statuses.size > 0) list = list.filter((p) => statuses.has(p.status));
    if (healths.size > 0) list = list.filter((p) => healths.has(p.health));
    if (sectors.size > 0) list = list.filter((p) => p.sector && sectors.has(p.sector));
    if (favoritesOnly) list = list.filter((p) => favorites?.has(p.id));
    return list;
  }, [searched, statuses, healths, sectors, favoritesOnly, favorites]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "name": return list.sort((a, b) => a.name.localeCompare(b.name));
      case "start": return list.sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
      case "end": return list.sort((a, b) => (a.target_end_date ?? "9999").localeCompare(b.target_end_date ?? "9999"));
      case "value": return list.sort((a, b) => (b.contract_value ?? 0) - (a.contract_value ?? 0));
      case "health": return list.sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health]);
      case "updated":
      default: return list;
    }
  }, [filtered, sortBy]);

  const favSorted = useMemo(() => {
    if (!favorites) return sorted;
    return [...sorted].sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)));
  }, [sorted, favorites]);

  const filterCount = statuses.size + healths.size + sectors.size + (favoritesOnly ? 1 : 0);

  if (!supabaseCM) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <p className="text-white/40 text-sm text-center">{t("home.notConfigured")}</p>
      </div>
    );
  }

  if (authLoading) {
    return <div className="min-h-screen bg-[#0a0a0b]" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-extrabold tracking-tight mb-3">{t("home.title")}</h1>
          <p className="text-white/45 text-sm mb-8">{t("home.signedOutSubtitle")}</p>
          <button onClick={() => signInWithGoogle()}
            className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
            style={{ backgroundColor: "#ff5100" }}>
            {t("common.signInGoogle")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-28">
        <div className="flex items-center gap-3 mb-5">
          <BackButton />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">{t("projects.title")}</h1>
            <p className="text-[12px] text-white/35 mt-0.5">{t("projects.subtitle")}</p>
          </div>
        </div>

        {!isLoading && (projects?.length ?? 0) > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
            {SUMMARY_CARDS.map((key) => (
              <button key={key} type="button" onClick={() => applySummary(key)}
                className="shrink-0 rounded-xl px-3.5 py-2 flex flex-col items-start gap-0.5 transition-colors"
                style={activeSummary === key ? { backgroundColor: "#ff510018", border: "1px solid #ff510055" } : { backgroundColor: "#0d0d0e", border: "1px solid transparent" }}>
                <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: activeSummary === key ? "#ff5100" : "rgba(255,255,255,0.35)" }}>
                  {t(`projects.summary.${key}`)}
                </span>
                <span className="text-[15px] font-extrabold text-white">{summaryCounts.get(key) ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        {!isLoading && (projects?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("projects.searchPlaceholder")}
              className="flex-1 min-w-0 bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors"
            />
            <button type="button" onClick={() => setShowFilters(true)} aria-label={t("projects.filters")}
              className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              {filterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff5100] text-black text-[9px] font-bold flex items-center justify-center">{filterCount}</span>}
            </button>
            <FieldSelect value={sortBy} onChange={setSortBy} triggerClassName="!w-10 !px-0 justify-center" menuClassName="left-auto right-0 w-56"
              options={(["updated", "name", "start", "end", "value", "health"] as SortKey[]).map((k) => ({ value: k, label: t(`projects.sort.${k}`) }))} />
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 shrink-0">
              <button type="button" onClick={() => setView("card")} aria-label={t("projects.viewCard")}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={view === "card" ? { backgroundColor: "#ff5100", color: "#000" } : { color: "rgba(255,255,255,0.4)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </button>
              <button type="button" onClick={() => setView("list")} aria-label={t("projects.viewList")}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={view === "list" ? { backgroundColor: "#ff5100", color: "#000" } : { color: "rgba(255,255,255,0.4)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
            </div>
          </div>
        )}

        {isLoading && <p className="text-white/30 text-sm">{t("projects.loading")}</p>}
        {error && <p className="text-red-400 text-sm">{t("projects.failedLoad")}: {(error as Error).message}</p>}

        {!isLoading && !error && (projects?.length ?? 0) === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 py-16 flex flex-col items-center justify-center text-center px-4">
            <p className="text-white/40 text-sm mb-4">{t("projects.noneYet")}</p>
            <button onClick={() => setShowNew(true)}
              className="px-5 py-2.5 rounded-full text-[11px] font-mono uppercase tracking-widest"
              style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100" }}>
              {t("projects.createFirst")}
            </button>
          </div>
        )}

        {!isLoading && (projects?.length ?? 0) > 0 && favSorted.length === 0 && (
          <p className="text-white/30 text-sm text-center py-10">{t("projects.noMatches")}</p>
        )}

        {!isLoading && favSorted.length > 0 && view === "card" && (
          <div className="flex flex-col gap-3">
            {favSorted.map((p) => (
              <ProjectCard key={p.id} project={p} favorite={favorites?.has(p.id) ?? false} onToggleFavorite={() => toggleFavorite(p.id)} t={t} />
            ))}
          </div>
        )}

        {!isLoading && favSorted.length > 0 && view === "list" && (
          <div className="flex flex-col gap-2">
            {favSorted.map((p) => (
              <ProjectRow key={p.id} project={p} favorite={favorites?.has(p.id) ?? false} onToggleFavorite={() => toggleFavorite(p.id)} t={t} />
            ))}
          </div>
        )}
      </main>

      <FAB onClick={() => setShowNew(true)} label={t("projects.new")} />

      {showNew && (
        <NewProjectSheet
          onClose={() => setShowNew(false)}
          onCreated={(p) => {
            setShowNew(false);
            queryClient.invalidateQueries({ queryKey: ["cm_projects"] });
            navigate({ to: "/cm/$projectId", params: { projectId: p.id } });
          }}
        />
      )}

      {showFilters && (
        <FilterSheet
          statuses={statuses} healths={healths} sectors={sectors} favoritesOnly={favoritesOnly}
          onChange={(patch) => {
            if (patch.statuses) setStatuses(patch.statuses);
            if (patch.healths) setHealths(patch.healths);
            if (patch.sectors) setSectors(patch.sectors);
            if (patch.favoritesOnly !== undefined) setFavoritesOnly(patch.favoritesOnly);
          }}
          onClose={() => setShowFilters(false)}
          t={t}
        />
      )}
    </div>
  );
}
