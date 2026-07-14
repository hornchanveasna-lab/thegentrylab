import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import { ProjectSettingsView, PeopleSection } from "@/components/cm/ProjectSettingsView";
import {
  BackButton, Card, EmptyState, SegmentedField, useCMTheme,
  PROJECT_STATUS_COLOR, PROJECT_HEALTH_COLOR, setLastProject,
} from "@/components/cm/shared";
import {
  useCMProject,
  useCMProjectMembers,
  useCMProjectFavorites,
  setCMProjectFavorite,
  useCMTasks,
  useCMInspections,
  useCMSafetyRecords,
  useCMSubmittals,
  useCMDailyLogs,
  useCMScheduleItems,
  useCMBOQItems,
  useCMEquipment,
  buildSCurveSeries,
  scheduleItemPlanPercent,
  jobRoleLabel,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/$projectId")({
  component: CMProjectPage,
});

type InsightTab = "overview" | "progress" | "quality" | "safety" | "documents" | "commercial" | "team" | "activity" | "settings";

const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const MODULE_SHORTCUTS: { to: string; labelKey: string; icon: React.ReactNode }[] = [
  { to: "/cm/site-diary", labelKey: "tile.siteDiary", icon: <svg {...iconProps}><rect x="4" y="4" width="13" height="16" rx="2" /><path d="M8 8.5h5M8 12.5h5" /><path d="M15.3 15.6l4-4 2 2-4 4h-2v-2z" /></svg> },
  { to: "/cm/punch-list", labelKey: "tile.punchList", icon: <svg {...iconProps}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> },
  { to: "/cm/inspection", labelKey: "tile.inspection", icon: <svg {...iconProps}><circle cx="10.2" cy="10.2" r="6.4" /><path d="M7.3 10.4l1.9 1.9 3.7-3.7" /><path d="M14.8 14.8L20 20" /></svg> },
  { to: "/cm/safety", labelKey: "tile.safety", icon: <svg {...iconProps}><path d="M4.3 15.2a7.7 7.7 0 0 1 15.4 0" /><rect x="2.8" y="15.2" width="18.4" height="2.8" rx="1.4" /><path d="M12 6.3V3.4" /><path d="M12 3.4h2.2" /></svg> },
  { to: "/cm/submittal", labelKey: "tile.submittal", icon: <svg {...iconProps}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg> },
  { to: "/cm/schedule", labelKey: "tile.schedule", icon: <svg {...iconProps}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18" /><path d="M8 2v4M16 2v4" /><path d="M7 13h4M7 17h7" /></svg> },
  { to: "/cm/boq", labelKey: "tile.boq", icon: <svg {...iconProps}><path d="M6 2h9l3 3v17H6z" /><path d="M9 7h6M9 11h6M9 15h4" /></svg> },
  { to: "/cm/manpower", labelKey: "tile.manpower", icon: <svg {...iconProps}><path d="M12 3a7 7 0 0 0-7 7v3h14v-3a7 7 0 0 0-7-7z" /><path d="M3 16h18" /><path d="M12 3v3" /></svg> },
  { to: "/cm/equipment", labelKey: "tile.equipment", icon: <svg {...iconProps}><path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4z" /></svg> },
  { to: "/cm/photos", labelKey: "tile.photo", icon: <svg {...iconProps}><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.4" /><circle cx="17.6" cy="10.4" r="0.6" fill="currentColor" stroke="none" /></svg> },
  { to: "/cm/directory", labelKey: "tile.directory", icon: <svg {...iconProps}><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.2" r="2.1" /><path d="M3.3 20c0-3.3 2.5-5.6 5.7-5.6s5.7 2.3 5.7 5.6" /><path d="M14.8 14.9c2.5.4 4.4 2.5 4.4 5.1" /></svg> },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}
function formatContractValue(value: number | null, currency: string | null): string | null {
  if (value == null) return null;
  return `${currency ? `${currency} ` : ""}${value.toLocaleString()}`;
}

function FavoriteButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label="Favorite"
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 bg-white/5 hover:bg-white/10 ${active ? "text-[#ff5100]" : "text-white/40"}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}

function OverviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1">{label}</p>
      <p className="text-white/80 font-bold text-[14px]">{value}</p>
    </div>
  );
}

function AttentionRow({ label, count, to, projectId }: { label: string; count: number; to: string; projectId: string }) {
  return (
    <Link to={to} onClick={() => setLastProject(projectId)} className="flex items-center justify-between rounded-xl bg-white/3 hover:bg-white/6 px-3.5 py-2.5 transition-colors">
      <span className="text-[12px] text-white/70">{label}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="font-mono text-[12px] font-bold text-red-400">{count}</span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/25"><path d="M6 3l5 5-5 5" /></svg>
      </span>
    </Link>
  );
}

function CMProjectPage() {
  const { projectId } = Route.useParams();
  const { user, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useCMTheme();
  const { data: project, isLoading: projectLoading } = useCMProject(projectId);
  const { data: favorites } = useCMProjectFavorites(user?.id);
  const { data: members } = useCMProjectMembers(projectId);
  const { data: tasks } = useCMTasks(projectId);
  const { data: inspections } = useCMInspections(projectId);
  const { data: safetyRecords } = useCMSafetyRecords(projectId);
  const { data: submittals } = useCMSubmittals(projectId);
  const { data: logs } = useCMDailyLogs(projectId);
  const { data: scheduleItems } = useCMScheduleItems(projectId);
  const { data: boqItems } = useCMBOQItems(projectId);
  const { data: equipment } = useCMEquipment(projectId);
  const [tab, setTab] = useState<InsightTab>("overview");

  const ownerId = project?.owner_id;
  const peopleCanCreate = usePermission(projectId, ownerId, "people", "create");
  const peopleCanEdit = usePermission(projectId, ownerId, "people", "edit");
  const peopleCanDelete = usePermission(projectId, ownerId, "people", "delete");
  const commercialVisible = usePermission(projectId, ownerId, "boq", "view");

  const todayStr = today();

  const projectManager = useMemo(() => (members ?? []).find((m) => m.job_role === "project_manager"), [members]);

  const openPunch = useMemo(() => (tasks ?? []).filter((x) => x.status !== "Done").length, [tasks]);
  const overduePunch = useMemo(() => (tasks ?? []).filter((x) => x.due_date && x.due_date < todayStr && x.status !== "Done").length, [tasks, todayStr]);
  const failedInspections = useMemo(() => (inspections ?? []).filter((x) => x.status === "Failed").length, [inspections]);
  const pendingInspections = useMemo(() => (inspections ?? []).filter((x) => x.status === "Scheduled").length, [inspections]);
  const openSafety = useMemo(() => (safetyRecords ?? []).filter((x) => x.status === "Open").length, [safetyRecords]);
  const criticalSafety = useMemo(() => (safetyRecords ?? []).filter((x) => x.status === "Open" && x.severity === "Critical").length, [safetyRecords]);
  const pendingSubmittals = useMemo(() => (submittals ?? []).filter((x) => x.status === "Submitted" || x.status === "Under Review").length, [submittals]);
  const actionSubmittals = useMemo(() => (submittals ?? []).filter((x) => x.status === "Rejected" || x.status === "Revise & Resubmit").length, [submittals]);

  const series = useMemo(() => (project ? buildSCurveSeries(project, logs ?? [], scheduleItems ?? []) : []), [project, logs, scheduleItems]);
  const todayPoint = useMemo(() => {
    const past = series.filter((p) => p.date <= todayStr);
    return past.length > 0 ? past[past.length - 1] : series[0];
  }, [series, todayStr]);
  const planPct = todayPoint?.plan ?? 0;
  const actualPct = todayPoint?.actual ?? null;
  const variance = actualPct != null ? actualPct - planPct : null;
  const varianceLabel = variance == null ? "—" : variance >= 3 ? t("dashboard.statusAhead") : variance <= -3 ? t("dashboard.statusBehind") : t("dashboard.statusOnTrack");
  const varianceColor = variance == null ? "#94a3b8" : variance >= 3 ? "#34d399" : variance <= -3 ? "#f43f5e" : "#fbbf24";
  const daysElapsed = project?.start_date ? Math.max(0, daysBetween(project.start_date, todayStr)) : null;
  const daysRemaining = project?.target_end_date ? Math.max(0, daysBetween(todayStr, project.target_end_date)) : null;

  const scheduleBuckets = useMemo(() => {
    let ahead = 0, onTrack = 0, behind = 0;
    for (const item of scheduleItems ?? []) {
      const diff = item.actual_percent - scheduleItemPlanPercent(item, todayStr);
      if (diff >= 3) ahead++; else if (diff <= -3) behind++; else onTrack++;
    }
    return { ahead, onTrack, behind };
  }, [scheduleItems, todayStr]);

  const latestManpowerDay = useMemo(
    () => [...(logs ?? [])].filter((l) => l.manpower.length > 0).sort((a, b) => b.log_date.localeCompare(a.log_date))[0],
    [logs],
  );
  const latestHeadcount = latestManpowerDay?.manpower.reduce((s, m) => s + m.count, 0) ?? 0;

  const equipmentCounts = useMemo(() => {
    const counts = { Operational: 0, Maintenance: 0, "Out of Service": 0 };
    for (const eq of equipment ?? []) counts[eq.status]++;
    return counts;
  }, [equipment]);

  const boqTotal = useMemo(() => (boqItems ?? []).reduce((s, i) => s + i.quantity * i.unit_cost, 0), [boqItems]);

  const activityFeed = useMemo(() => {
    type Row = { id: string; ts: string; label: string; to: string };
    const rows: Row[] = [];
    for (const l of logs ?? []) rows.push({ id: `sd-${l.id}`, ts: l.updated_at, label: `${t("siteDiary.title")} — ${l.log_date}`, to: "/cm/site-diary" });
    for (const x of tasks ?? []) rows.push({ id: `pl-${x.id}`, ts: x.updated_at, label: `${t("punchList.title")} — ${x.title}`, to: "/cm/punch-list" });
    for (const x of inspections ?? []) rows.push({ id: `in-${x.id}`, ts: x.updated_at, label: `${t("inspection.title")} — ${x.title}`, to: "/cm/inspection" });
    for (const x of safetyRecords ?? []) rows.push({ id: `sf-${x.id}`, ts: x.updated_at, label: `${t("safety.title")} — ${x.title}`, to: "/cm/safety" });
    for (const x of submittals ?? []) rows.push({ id: `sb-${x.id}`, ts: x.updated_at, label: `${t("submittal.title")} — ${x.title}`, to: "/cm/submittal" });
    return rows.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 15);
  }, [logs, tasks, inspections, safetyRecords, submittals, t]);

  const goToModule = (to: string) => {
    if (projectId) setLastProject(projectId);
    navigate({ to });
  };

  const toggleFavorite = () => {
    if (!user || !projectId) return;
    const isFav = favorites?.has(projectId) ?? false;
    setCMProjectFavorite(user.id, projectId, !isFav);
  };

  const invalidateProject = () => queryClient.invalidateQueries({ queryKey: ["cm_project", projectId] });

  const chartGrid = theme === "light" ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)";
  const chartTick = theme === "light" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.35)";
  const chartTooltipBg = theme === "light" ? "#ffffff" : "#181818";
  const chartTooltipBorder = theme === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)";
  const chartTooltipLabel = theme === "light" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)";

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()}
          className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
          style={{ backgroundColor: "#ff5100" }}>
          {t("common.signInGoogle")}
        </button>
      </div>
    );
  }

  if (projectLoading) {
    return <div className="min-h-screen bg-[#0a0a0b]" />;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center gap-3 font-sans">
        <p className="text-white/40 text-sm">{t("projects.notFound")}</p>
        <Link to="/cm/projects" className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#ff5100" }}>← {t("projects.title")}</Link>
      </div>
    );
  }

  const sc = PROJECT_STATUS_COLOR[project.status];
  const hc = PROJECT_HEALTH_COLOR[project.health];
  const value = formatContractValue(project.contract_value, project.currency);

  const TAB_OPTIONS: { value: InsightTab; label: string }[] = [
    { value: "overview", label: t("insight.overview") },
    { value: "progress", label: t("insight.progress") },
    { value: "quality", label: t("insight.quality") },
    { value: "safety", label: t("safety.title") },
    { value: "documents", label: t("insight.documents") },
    ...(commercialVisible ? [{ value: "commercial" as InsightTab, label: t("insight.commercial") }] : []),
    { value: "team", label: t("insight.team") },
    { value: "activity", label: t("insight.activity") },
    { value: "settings", label: t("projectSettings.title") },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-16">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to="/cm/projects" />
          <h1 className="text-xl font-extrabold tracking-tight text-white flex-1 truncate">{t("insight.title")}</h1>
          <FavoriteButton active={favorites?.has(projectId) ?? false} onToggle={toggleFavorite} />
        </div>

        <div className="rounded-2xl bg-[#0d0d0e] p-5 mb-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex items-center gap-3">
              {project.client_logo_url && <img src={project.client_logo_url} alt="" className="w-11 h-11 rounded-xl object-contain bg-white/5 shrink-0" />}
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold tracking-tight text-white truncate">{project.name}</h2>
                {project.project_code && <p className="font-mono text-[10px] text-white/25">{project.project_code}</p>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: `${sc}15` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc }} />
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: sc }}>{t(`status.${project.status}`)}</span>
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: `${hc}15` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hc }} />
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: hc }}>{t(`health.${project.health}`)}</span>
            </span>
            {project.sector && <span className="px-2.5 py-1 rounded-full bg-white/5 font-mono text-[9px] uppercase tracking-widest text-white/40">{t(`sector.${project.sector}`)}</span>}
          </div>
          {project.client && <p className="text-[12px] text-white/45 mb-1">{t("projects.clientLabel")} <span className="text-white/70">{project.client}</span></p>}
          {project.location && <p className="text-[12px] text-white/45 mb-1">{project.location}</p>}
          {projectManager && <p className="text-[12px] text-white/45 mb-1">{jobRoleLabel("project_manager", t)}: <span className="text-white/70">{projectManager.display_name || projectManager.email}</span></p>}
          <div className="flex items-center justify-between mt-2">
            {(project.start_date || project.target_end_date) && (
              <p className="font-mono text-[10px] text-white/25 uppercase tracking-widest">{project.start_date ?? "—"} → {project.target_end_date ?? "—"}</p>
            )}
            {value && commercialVisible && <p className="font-mono text-[10px] text-white/35 uppercase tracking-widest ml-auto">{value}</p>}
          </div>
        </div>

        <div className="mb-5">
          <SegmentedField options={TAB_OPTIONS} value={tab} onChange={setTab} />
        </div>

        {tab === "overview" && (
          <div className="flex flex-col gap-4">
            <Card title={t("insight.overview")}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <OverviewCard label={t("dashboard.actualLatest")} value={actualPct != null ? `${actualPct.toFixed(0)}%` : "—"} />
                <OverviewCard label={t("dashboard.planToday")} value={`${planPct.toFixed(0)}%`} />
                <OverviewCard label={t("insight.openPunch")} value={`${openPunch}`} />
                <OverviewCard label={t("insight.pendingSubmittals")} value={`${pendingSubmittals}`} />
                <OverviewCard label={t("insight.openSafety")} value={`${openSafety}`} />
                <OverviewCard label={t("insight.pendingInspections")} value={`${pendingInspections}`} />
                <OverviewCard label={t("dashboard.latestHeadcount")} value={`${latestHeadcount}`} />
                <OverviewCard label={t("equipmentStatus.Operational")} value={`${equipmentCounts.Operational}`} />
                {daysElapsed != null && <OverviewCard label={t("dashboard.daysElapsed")} value={`${daysElapsed}`} />}
                {daysRemaining != null && <OverviewCard label={t("dashboard.daysRemaining")} value={`${daysRemaining}`} />}
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${varianceColor}18` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: varianceColor }} />
                <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: varianceColor }}>{varianceLabel}</span>
              </div>
            </Card>

            <Card title={t("insight.attentionRequired")}>
              <div className="flex flex-col gap-2">
                {criticalSafety > 0 && <AttentionRow label={t("insight.criticalSafety")} count={criticalSafety} to="/cm/safety" projectId={projectId} />}
                {overduePunch > 0 && <AttentionRow label={t("insight.overduePunch")} count={overduePunch} to="/cm/punch-list" projectId={projectId} />}
                {failedInspections > 0 && <AttentionRow label={t("insight.failedInspections")} count={failedInspections} to="/cm/inspection" projectId={projectId} />}
                {actionSubmittals > 0 && <AttentionRow label={t("insight.actionSubmittals")} count={actionSubmittals} to="/cm/submittal" projectId={projectId} />}
                {scheduleBuckets.behind > 0 && <AttentionRow label={t("insight.behindSchedule")} count={scheduleBuckets.behind} to="/cm/schedule" projectId={projectId} />}
                {criticalSafety === 0 && overduePunch === 0 && failedInspections === 0 && actionSubmittals === 0 && scheduleBuckets.behind === 0 && (
                  <p className="text-white/30 text-[12px] text-center py-3">{t("insight.nothingNeedsAttention")}</p>
                )}
              </div>
            </Card>

            <Card title={t("insight.modules")}>
              <div className="grid grid-cols-4 gap-3">
                {MODULE_SHORTCUTS.map((m) => (
                  <button key={m.to} onClick={() => goToModule(m.to)} className="flex flex-col items-center gap-1.5 text-white/70 hover:text-white transition-colors">
                    <span className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center">{m.icon}</span>
                    <span className="text-[10px] text-center leading-tight">{t(m.labelKey)}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "progress" && (
          <div className="flex flex-col gap-4">
            <Card title={t("dashboard.sCurve")}>
              {series.length === 0 ? (
                <p className="text-white/30 text-[12px]">{t("dashboard.notEnoughData")}</p>
              ) : (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: chartTick, fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={30} />
                      <YAxis yAxisId="left" tick={{ fill: chartTick, fontSize: 9 }} tickLine={false} axisLine={false} width={28} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: chartTick, fontSize: 9 }} tickLine={false} axisLine={false} width={28} />
                      <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 12, fontSize: 11 }} labelStyle={{ color: chartTooltipLabel }} />
                      <Legend wrapperStyle={{ fontSize: 10, color: chartTick }} />
                      <Bar yAxisId="left" dataKey="manpower" name={t("dashboard.manpowerLegend")} fill="#94a3b8" fillOpacity={0.5} radius={[2, 2, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="plan" name={t("dashboard.planLegend")} stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="actual" name={t("dashboard.actualLegend")} stroke="#ff5100" strokeWidth={2} dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
            <Card title={t("dashboard.scheduleSummary")}>
              <div className="flex items-center gap-4 mb-3">
                <div><p className="font-bold text-[14px]" style={{ color: "#34d399" }}>{scheduleBuckets.ahead}</p><p className="font-mono text-[9px] text-white/30">{t("dashboard.statusAhead")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#fbbf24" }}>{scheduleBuckets.onTrack}</p><p className="font-mono text-[9px] text-white/30">{t("dashboard.statusOnTrack")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#f43f5e" }}>{scheduleBuckets.behind}</p><p className="font-mono text-[9px] text-white/30">{t("dashboard.statusBehind")}</p></div>
              </div>
              <button onClick={() => goToModule("/cm/schedule")} className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("dashboard.viewSchedule")}</button>
            </Card>
            <Card title={t("dashboard.manpowerCard")}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("dashboard.latestHeadcount")}</span>
                <span className="font-bold text-[14px] text-white/80">{latestHeadcount}</span>
              </div>
              <button onClick={() => goToModule("/cm/manpower")} className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("dashboard.viewManpower")}</button>
            </Card>
          </div>
        )}

        {tab === "quality" && (
          <div className="flex flex-col gap-4">
            <Card title={t("inspection.title")}>
              <div className="flex items-center gap-4 mb-3 flex-wrap">
                <div><p className="font-bold text-[14px] text-white/80">{(inspections ?? []).length}</p><p className="font-mono text-[9px] text-white/30">{t("insight.total")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#34d399" }}>{(inspections ?? []).filter((i) => i.status === "Passed").length}</p><p className="font-mono text-[9px] text-white/30">{t("insight.passed")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#f43f5e" }}>{failedInspections}</p><p className="font-mono text-[9px] text-white/30">{t("insight.failed")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#fbbf24" }}>{pendingInspections}</p><p className="font-mono text-[9px] text-white/30">{t("insight.scheduled")}</p></div>
              </div>
              <button onClick={() => goToModule("/cm/inspection")} className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("insight.viewInspections")}</button>
            </Card>
            <Card title={t("punchList.title")}>
              <div className="flex items-center gap-4 mb-3">
                <div><p className="font-bold text-[14px] text-white/80">{openPunch}</p><p className="font-mono text-[9px] text-white/30">{t("insight.open")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#34d399" }}>{(tasks ?? []).filter((x) => x.status === "Done").length}</p><p className="font-mono text-[9px] text-white/30">{t("insight.closed")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#f43f5e" }}>{overduePunch}</p><p className="font-mono text-[9px] text-white/30">{t("insight.overdue")}</p></div>
              </div>
              <button onClick={() => goToModule("/cm/punch-list")} className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("insight.viewPunchList")}</button>
            </Card>
          </div>
        )}

        {tab === "safety" && (
          <div className="flex flex-col gap-4">
            <Card title={t("safety.title")}>
              <div className="flex items-center gap-4 mb-3 flex-wrap">
                <div><p className="font-bold text-[14px] text-white/80">{(safetyRecords ?? []).length}</p><p className="font-mono text-[9px] text-white/30">{t("insight.total")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#f43f5e" }}>{openSafety}</p><p className="font-mono text-[9px] text-white/30">{t("insight.open")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#34d399" }}>{(safetyRecords ?? []).filter((x) => x.status === "Resolved").length}</p><p className="font-mono text-[9px] text-white/30">{t("insight.resolved")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#f43f5e" }}>{criticalSafety}</p><p className="font-mono text-[9px] text-white/30">{t("insight.critical")}</p></div>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div><p className="font-bold text-[13px] text-white/70">{(safetyRecords ?? []).filter((x) => x.record_type === "Toolbox Talk").length}</p><p className="font-mono text-[9px] text-white/30">{t("insight.toolboxTalks")}</p></div>
                <div><p className="font-bold text-[13px] text-white/70">{(safetyRecords ?? []).filter((x) => x.record_type === "Incident").length}</p><p className="font-mono text-[9px] text-white/30">{t("insight.incidents")}</p></div>
              </div>
              <button onClick={() => goToModule("/cm/safety")} className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("insight.viewSafety")}</button>
            </Card>
          </div>
        )}

        {tab === "documents" && (
          <div className="flex flex-col gap-4">
            <Card title={t("submittal.title")}>
              <div className="flex items-center gap-4 mb-3 flex-wrap">
                <div><p className="font-bold text-[14px] text-white/80">{(submittals ?? []).length}</p><p className="font-mono text-[9px] text-white/30">{t("insight.total")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#fbbf24" }}>{pendingSubmittals}</p><p className="font-mono text-[9px] text-white/30">{t("insight.pending")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#34d399" }}>{(submittals ?? []).filter((x) => x.status === "Approved" || x.status === "Approved as Noted").length}</p><p className="font-mono text-[9px] text-white/30">{t("insight.approved")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#f43f5e" }}>{actionSubmittals}</p><p className="font-mono text-[9px] text-white/30">{t("insight.needsAction")}</p></div>
              </div>
              <button onClick={() => goToModule("/cm/submittal")} className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("insight.viewSubmittals")}</button>
            </Card>
            <Card title={t("tile.photo")}>
              <p className="text-[12px] text-white/45 mb-3">{t("insight.photosHint")}</p>
              <button onClick={() => goToModule("/cm/photos")} className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("insight.viewPhotos")}</button>
            </Card>
          </div>
        )}

        {tab === "commercial" && commercialVisible && (
          <div className="flex flex-col gap-4">
            <Card title={t("insight.commercial")}>
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("projectSettings.contractValue")}</span>
                  <span className="font-mono text-[13px] font-bold" style={{ color: "#ff5100" }}>{value ?? "—"}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("dashboard.totalValue")} ({t("boq.title")})</span>
                  <span className="font-mono text-[13px] font-bold text-white/70">{boqTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <button onClick={() => goToModule("/cm/boq")} className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("dashboard.viewBoq")}</button>
            </Card>
          </div>
        )}

        {tab === "team" && ownerId && (
          <PeopleSection ownerId={ownerId} projectId={project.id} canCreate={peopleCanCreate} canEdit={peopleCanEdit} canDelete={peopleCanDelete} />
        )}

        {tab === "activity" && (
          <Card title={t("insight.recentActivity")}>
            {activityFeed.length === 0 ? (
              <EmptyState message={t("insight.noActivity")} />
            ) : (
              <div className="flex flex-col gap-1">
                {activityFeed.map((row) => (
                  <button key={row.id} onClick={() => goToModule(row.to)} className="flex items-center justify-between gap-2 rounded-xl hover:bg-white/5 px-2 py-2 text-left transition-colors">
                    <span className="text-[12px] text-white/70 truncate">{row.label}</span>
                    <span className="font-mono text-[9px] text-white/25 shrink-0">{row.ts.slice(0, 10)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "settings" && (
          <ProjectSettingsView project={project} ownerId={project.owner_id} onProjectChanged={invalidateProject} />
        )}
      </main>
    </div>
  );
}
