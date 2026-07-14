import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import {
  useCMProjects, useCMProject, useCMDailyLogs, useCMDailyActivityRange,
  useCMInspections, useCMTasks, useCMSafetyRecords, useCMSubmittals,
  useCMEquipment, useActiveCMBOQItems, useCMScheduleItems, useAllCMPhotos,
  buildSCurveSeries,
  type InspectionStatus, type TaskStatus, type SafetySeverity, type SubmittalStatus, type EquipmentStatus,
} from "@/lib/cm-data";
import { FieldSelect, CMDailyActivityList, MODULE_ROUTES, setPendingHighlight } from "@/components/cm/shared";

type ReportType = "daily" | "progress" | "inspection" | "punchList" | "safety" | "manpower" | "equipment" | "submittal" | "boq" | "dashboard" | "photo";
const REPORT_TYPES: ReportType[] = ["daily", "progress", "inspection", "punchList", "safety", "manpower", "equipment", "submittal", "boq", "dashboard", "photo"];

interface CMReportsSearch {
  project?: string;
  from?: string;
  to?: string;
  type?: string;
}

export const Route = createFileRoute("/cm/reports")({
  head: () => ({ meta: [{ title: "Reports — Construction Management App" }] }),
  validateSearch: (search: Record<string, unknown>): CMReportsSearch => ({
    project: typeof search.project === "string" ? search.project : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
  }),
  component: CMReportsPage,
});

const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";
const cardCls = "rounded-2xl bg-[#0d0d0e] print:bg-white print:border print:border-black/10 px-3 py-3 text-center";
const rowCls = "rounded-2xl bg-[#0d0d0e] print:bg-white print:border print:border-black/10 px-4 py-3";

const INSPECTION_STATUS_COLOR: Record<InspectionStatus, string> = { Scheduled: "#94a3b8", Passed: "#34d399", Failed: "#f43f5e", "Not Applicable": "#fbbf24" };
const TASK_STATUS_COLOR: Record<TaskStatus, string> = { "To Do": "#94a3b8", "In Progress": "#fbbf24", Blocked: "#f43f5e", "Ready for Check": "#a78bfa", Done: "#34d399" };
const SAFETY_SEVERITY_COLOR: Record<SafetySeverity, string> = { Low: "#94a3b8", Medium: "#fbbf24", High: "#f97316", Critical: "#f43f5e" };
const SUBMITTAL_STATUS_COLOR: Record<SubmittalStatus, string> = {
  Draft: "#94a3b8", Submitted: "#60a5fa", "Under Review": "#a78bfa", Approved: "#34d399",
  "Approved as Noted": "#34d399", "Revise & Resubmit": "#fbbf24", Rejected: "#f43f5e",
};
const EQUIPMENT_STATUS_COLOR: Record<EquipmentStatus, string> = { Operational: "#34d399", Maintenance: "#fbbf24", "Out of Service": "#f43f5e" };

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function StatGrid({ stats }: { stats: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:border print:border-black/10 print:rounded-none">
      {stats.map((s) => (
        <div key={s.label} className={cardCls}>
          <p className="text-lg font-extrabold print:text-black">{s.value}</p>
          <p className="font-mono text-[8px] uppercase tracking-widest text-white/30 print:text-black/50 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function CMReportsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const { data: projects } = useCMProjects(user?.id);
  const searchParams = Route.useSearch();
  const [projectId, setProjectId] = useState<string>(() => searchParams.project ?? "");
  const [fromDate, setFromDate] = useState(() => searchParams.from ?? isoDaysAgo(7));
  const [toDate, setToDate] = useState(() => searchParams.to ?? new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState<ReportType>(() => (REPORT_TYPES as string[]).includes(searchParams.type ?? "") ? (searchParams.type as ReportType) : "daily");

  const { data: project } = useCMProject(projectId || undefined);
  const { data: logs, isLoading: logsLoading } = useCMDailyLogs(projectId || undefined);
  const { data: activityByDate } = useCMDailyActivityRange(projectId || undefined, fromDate, toDate);
  const { data: inspections } = useCMInspections(projectId || undefined);
  const { data: tasks } = useCMTasks(projectId || undefined);
  const { data: safetyRecords } = useCMSafetyRecords(projectId || undefined);
  const { data: submittals } = useCMSubmittals(projectId || undefined);
  const { data: equipment } = useCMEquipment(projectId || undefined);
  const { data: boqItems } = useActiveCMBOQItems(projectId || undefined);
  const { data: scheduleItems } = useCMScheduleItems(projectId || undefined);
  const { data: allPhotos } = useAllCMPhotos(user?.id);

  const activeProject = (projects ?? []).find((p) => p.id === projectId);

  const filteredLogs = useMemo(
    () => (logs ?? []).filter((l) => l.log_date >= fromDate && l.log_date <= toDate).sort((a, b) => a.log_date.localeCompare(b.log_date)),
    [logs, fromDate, toDate],
  );
  const totalPhotos = filteredLogs.reduce((sum, l) => sum + l.photos.length, 0);
  const manpowerDays = filteredLogs.filter((l) => l.manpower.length > 0);
  const avgWorkforce = manpowerDays.length
    ? Math.round(manpowerDays.reduce((s, l) => s + l.manpower.reduce((ms, m) => ms + m.count, 0), 0) / manpowerDays.length)
    : null;
  const totalDelayHours = filteredLogs.reduce((sum, l) => sum + l.delays.reduce((ds, d) => ds + d.hours_lost, 0), 0);
  const latestProgress = [...filteredLogs].reverse().find((l) => l.progress_pct != null)?.progress_pct ?? null;

  const sCurve = useMemo(
    () => (project ? buildSCurveSeries(project, logs ?? [], scheduleItems ?? []) : []),
    [project, logs, scheduleItems],
  );
  const progressPoint = useMemo(() => {
    const past = sCurve.filter((p) => p.date <= toDate);
    return past.length > 0 ? past[past.length - 1] : sCurve[0];
  }, [sCurve, toDate]);
  const planPct = progressPoint?.plan ?? 0;
  const actualPct = progressPoint?.actual ?? null;
  const variance = actualPct != null ? Math.round((actualPct - planPct) * 10) / 10 : null;

  const filteredInspections = useMemo(
    () => (inspections ?? []).filter((i) => i.inspection_date >= fromDate && i.inspection_date <= toDate),
    [inspections, fromDate, toDate],
  );
  const filteredTasks = useMemo(
    () => (tasks ?? []).filter((tk) => tk.created_at.slice(0, 10) >= fromDate && tk.created_at.slice(0, 10) <= toDate),
    [tasks, fromDate, toDate],
  );
  const openOverdueTasks = (tasks ?? []).filter((tk) => tk.status !== "Done" && tk.due_date && tk.due_date < new Date().toISOString().slice(0, 10));
  const filteredSafety = useMemo(
    () => (safetyRecords ?? []).filter((r) => r.record_date >= fromDate && r.record_date <= toDate),
    [safetyRecords, fromDate, toDate],
  );
  const filteredSubmittals = useMemo(
    () => (submittals ?? []).filter((s) => (s.submitted_date ?? s.due_date ?? "") >= fromDate && (s.submitted_date ?? s.due_date ?? "") <= toDate),
    [submittals, fromDate, toDate],
  );
  const filteredPhotos = useMemo(
    () => (allPhotos ?? []).filter((p) => p.projectId === projectId && p.date >= fromDate && p.date <= toDate).sort((a, b) => b.date.localeCompare(a.date)),
    [allPhotos, projectId, fromDate, toDate],
  );

  const manpowerByTrade = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of filteredLogs) for (const m of l.manpower) map.set(m.trade, (map.get(m.trade) ?? 0) + m.count);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredLogs]);
  const totalManDays = filteredLogs.reduce((sum, l) => sum + l.manpower.reduce((ms, m) => ms + m.count, 0), 0);

  const boqProgress = useMemo(() => {
    const delivered = new Map<string, number>();
    for (const l of logs ?? []) {
      for (const d of l.deliveries) {
        if (!d.boq_item_id) continue;
        const qty = parseFloat(d.quantity) || 0;
        delivered.set(d.boq_item_id, (delivered.get(d.boq_item_id) ?? 0) + qty);
      }
    }
    return (boqItems ?? []).map((b) => {
      const deliveredQty = delivered.get(b.id) ?? 0;
      const pct = b.quantity > 0 ? Math.min(100, Math.round((deliveredQty / b.quantity) * 100)) : 0;
      return { ...b, deliveredQty, pct };
    });
  }, [logs, boqItems]);
  const boqOverallPct = boqProgress.length > 0 ? Math.round(boqProgress.reduce((s, b) => s + b.pct, 0) / boqProgress.length) : 0;

  const openTasks = (tasks ?? []).filter((tk) => tk.status !== "Done");
  const openSafety = (safetyRecords ?? []).filter((r) => r.status === "Open");
  const pendingSubmittals = (submittals ?? []).filter((s) => s.status === "Submitted" || s.status === "Under Review");
  const operationalEquipment = (equipment ?? []).filter((e) => e.status === "Operational");

  const reportTitle: Record<ReportType, string> = {
    daily: t("reports.type.daily"), progress: t("reports.type.progress"), inspection: t("reports.type.inspection"),
    punchList: t("reports.type.punchList"), safety: t("reports.type.safety"), manpower: t("reports.type.manpower"),
    equipment: t("reports.type.equipment"), submittal: t("reports.type.submittal"), boq: t("reports.type.boq"),
    dashboard: t("reports.type.dashboard"), photo: t("reports.type.photo"),
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;

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

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans print:bg-white print:text-black">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6 print:hidden">
          <Link to="/cm" className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight text-white">{t("reports.title")}</h1>
        </div>

        <div className="flex flex-col gap-3 mb-6 print:hidden">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("reports.project")}</span>
            <FieldSelect
              value={projectId}
              onChange={setProjectId}
              placeholder={t("reports.selectProject")}
              options={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("reports.reportType")}</span>
            <FieldSelect value={reportType} onChange={setReportType} options={REPORT_TYPES.map((rt) => ({ value: rt, label: reportTitle[rt] }))} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("reports.from")}</span>
              <input type="date" className={inputCls} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("reports.to")}</span>
              <input type="date" className={inputCls} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2">
            {[{ label: t("reports.days7"), days: 7 }, { label: t("reports.days30"), days: 30 }, { label: t("reports.days90"), days: 90 }].map((r) => (
              <button key={r.days} onClick={() => setFromDate(isoDaysAgo(r.days))}
                className="px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest bg-white/5 text-white/50 hover:text-white transition-colors">
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {!projectId && <p className="text-white/30 text-sm print:hidden">{t("reports.pickPrompt")}</p>}

        {projectId && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between print:mb-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight print:text-black">{activeProject?.name}</h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 print:text-black/50">{reportTitle[reportType]}</p>
                <p className="font-mono text-[11px] text-white/40 print:text-black/60 mt-0.5">{fromDate} → {toDate}</p>
              </div>
              <button onClick={() => window.print()} className="px-4 py-2 rounded-full text-[10px] font-mono uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-colors print:hidden">
                {t("reports.print")}
              </button>
            </div>

            {logsLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}

            {!logsLoading && reportType === "daily" && (
              <>
                <StatGrid stats={[
                  { label: t("reports.diaryEntries"), value: filteredLogs.length },
                  { label: t("reports.avgWorkforce"), value: avgWorkforce ?? "—" },
                  { label: t("reports.latestProgress"), value: latestProgress != null ? `${latestProgress}%` : "—" },
                  { label: t("reports.delayHours"), value: totalDelayHours > 0 ? totalDelayHours : "—" },
                ]} />
                {totalPhotos > 0 && <p className="text-[12px] text-white/40 print:text-black/60">{totalPhotos} {t("reports.photosLogged")}</p>}
                {filteredLogs.length === 0 && <p className="text-white/30 text-sm">{t("reports.noEntriesInRange")}</p>}
                <div className="flex flex-col gap-2">
                  {filteredLogs.map((l) => (
                    <div key={l.id} className={rowCls}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[11px] text-white/70 print:text-black">{l.log_date}</span>
                        {l.progress_pct != null && <span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{l.progress_pct}%</span>}
                      </div>
                      {l.weather && <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 print:text-black/50 mb-1">{t(`weather.${l.weather}`)}{l.manpower.length > 0 ? ` · ${l.manpower.reduce((s, m) => s + m.count, 0)} ${t("reports.workers")}` : ""}</p>}
                      {l.activities && <p className="text-[12px] text-white/60 print:text-black/80">{l.activities}</p>}
                      {l.issues && <p className="text-[11px] text-red-400/80 print:text-red-700 mt-1">{t("reports.issue")} {l.issues}</p>}
                      <div className="print:hidden mt-2">
                        <CMDailyActivityList activity={activityByDate?.get(l.log_date)} projectId={l.project_id}
                          onOpenItem={(module, recordId, pid) => { setPendingHighlight(module, recordId, pid, ""); navigate({ to: MODULE_ROUTES[module] }); }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === "progress" && (
              <>
                <StatGrid stats={[
                  { label: t("reports.planPercent"), value: `${Math.round(planPct)}%` },
                  { label: t("reports.actualPercent"), value: actualPct != null ? `${Math.round(actualPct)}%` : "—" },
                  { label: t("reports.variance"), value: variance != null ? `${variance > 0 ? "+" : ""}${variance}%` : "—" },
                  { label: t("reports.delayHours"), value: totalDelayHours > 0 ? totalDelayHours : "—" },
                ]} />
                <p className="text-[12px] text-white/40 print:text-black/60">{filteredLogs.length} {t("reports.diaryEntries").toLowerCase()} · {t("reports.avgWorkforce").toLowerCase()}: {avgWorkforce ?? "—"}</p>
              </>
            )}

            {reportType === "inspection" && (
              <>
                <StatGrid stats={[
                  { label: t("reports.total"), value: filteredInspections.length },
                  { label: t("inspectionStatus.Passed"), value: filteredInspections.filter((i) => i.status === "Passed").length },
                  { label: t("inspectionStatus.Failed"), value: filteredInspections.filter((i) => i.status === "Failed").length },
                  { label: t("inspectionStatus.Scheduled"), value: filteredInspections.filter((i) => i.status === "Scheduled").length },
                ]} />
                {filteredInspections.length === 0 && <p className="text-white/30 text-sm">{t("reports.noEntriesInRange")}</p>}
                <div className="flex flex-col gap-2">
                  {filteredInspections.map((i) => (
                    <div key={i.id} className={`${rowCls} flex items-center justify-between gap-3`}>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] text-white/30 print:text-black/50">{i.inspection_date} {i.doc_number ? `· ${i.doc_number}` : ""}</p>
                        <p className="text-[12px] text-white/80 print:text-black truncate">{i.title}</p>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-widest shrink-0" style={{ color: INSPECTION_STATUS_COLOR[i.status] }}>{t(`inspectionStatus.${i.status}`)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === "punchList" && (
              <>
                <StatGrid stats={[
                  { label: t("reports.total"), value: filteredTasks.length },
                  { label: t("taskStatus.To Do"), value: (tasks ?? []).filter((tk) => tk.status === "To Do").length },
                  { label: t("taskStatus.In Progress"), value: (tasks ?? []).filter((tk) => tk.status === "In Progress").length },
                  { label: t("reports.overdue"), value: openOverdueTasks.length },
                ]} />
                {filteredTasks.length === 0 && <p className="text-white/30 text-sm">{t("reports.noEntriesInRange")}</p>}
                <div className="flex flex-col gap-2">
                  {filteredTasks.map((tk) => (
                    <div key={tk.id} className={`${rowCls} flex items-center justify-between gap-3`}>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] text-white/30 print:text-black/50">{tk.due_date ?? tk.created_at.slice(0, 10)} {tk.doc_number ? `· ${tk.doc_number}` : ""}</p>
                        <p className="text-[12px] text-white/80 print:text-black truncate">{tk.title}</p>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-widest shrink-0" style={{ color: TASK_STATUS_COLOR[tk.status] }}>{t(`taskStatus.${tk.status}`)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === "safety" && (
              <>
                <StatGrid stats={[
                  { label: t("reports.total"), value: filteredSafety.length },
                  { label: t("safetySeverity.Critical"), value: filteredSafety.filter((r) => r.severity === "Critical").length },
                  { label: t("safetySeverity.High"), value: filteredSafety.filter((r) => r.severity === "High").length },
                  { label: t("safety.resolved"), value: filteredSafety.filter((r) => r.status === "Resolved").length },
                ]} />
                {filteredSafety.length === 0 && <p className="text-white/30 text-sm">{t("reports.noEntriesInRange")}</p>}
                <div className="flex flex-col gap-2">
                  {filteredSafety.map((r) => (
                    <div key={r.id} className={`${rowCls} flex items-center justify-between gap-3`}>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] text-white/30 print:text-black/50">{r.record_date} {r.doc_number ? `· ${r.doc_number}` : ""} · {t(`safetyType.${r.record_type}`)}</p>
                        <p className="text-[12px] text-white/80 print:text-black truncate">{r.title}</p>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-widest shrink-0" style={{ color: SAFETY_SEVERITY_COLOR[r.severity] }}>{t(`safetySeverity.${r.severity}`)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === "manpower" && (
              <>
                <StatGrid stats={[
                  { label: t("reports.totalManDays"), value: totalManDays },
                  { label: t("reports.avgWorkforce"), value: avgWorkforce ?? "—" },
                  { label: t("reports.diaryEntries"), value: filteredLogs.length },
                  { label: t("reports.trades"), value: manpowerByTrade.length },
                ]} />
                {manpowerByTrade.length === 0 && <p className="text-white/30 text-sm">{t("reports.noEntriesInRange")}</p>}
                <div className="flex flex-col gap-2">
                  {manpowerByTrade.map(([trade, count]) => (
                    <div key={trade} className={`${rowCls} flex items-center justify-between`}>
                      <span className="text-[12px] text-white/80 print:text-black">{trade}</span>
                      <span className="font-mono text-[12px] text-white/50 print:text-black/60">{count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === "equipment" && (
              <>
                <StatGrid stats={[
                  { label: t("reports.total"), value: (equipment ?? []).length },
                  { label: t("equipmentStatus.Operational"), value: operationalEquipment.length },
                  { label: t("equipmentStatus.Maintenance"), value: (equipment ?? []).filter((e) => e.status === "Maintenance").length },
                  { label: t("equipmentStatus.Out of Service"), value: (equipment ?? []).filter((e) => e.status === "Out of Service").length },
                ]} />
                {(equipment ?? []).length === 0 && <p className="text-white/30 text-sm">{t("reports.noEntriesInRange")}</p>}
                <div className="flex flex-col gap-2">
                  {(equipment ?? []).map((e) => (
                    <div key={e.id} className={`${rowCls} flex items-center justify-between gap-3`}>
                      <div className="min-w-0">
                        <p className="text-[12px] text-white/80 print:text-black truncate">{e.name}</p>
                        {e.type && <p className="font-mono text-[10px] text-white/30 print:text-black/50">{e.type} · ×{e.quantity}</p>}
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-widest shrink-0" style={{ color: EQUIPMENT_STATUS_COLOR[e.status] }}>{t(`equipmentStatus.${e.status}`)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === "submittal" && (
              <>
                <StatGrid stats={[
                  { label: t("reports.total"), value: filteredSubmittals.length },
                  { label: t("submittalStatus.Approved"), value: filteredSubmittals.filter((s) => s.status === "Approved").length },
                  { label: t("reports.pending"), value: filteredSubmittals.filter((s) => s.status === "Submitted" || s.status === "Under Review").length },
                  { label: t("submittalStatus.Rejected"), value: filteredSubmittals.filter((s) => s.status === "Rejected").length },
                ]} />
                {filteredSubmittals.length === 0 && <p className="text-white/30 text-sm">{t("reports.noEntriesInRange")}</p>}
                <div className="flex flex-col gap-2">
                  {filteredSubmittals.map((s) => (
                    <div key={s.id} className={`${rowCls} flex items-center justify-between gap-3`}>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] text-white/30 print:text-black/50">{s.submitted_date ?? s.due_date} {s.doc_number ? `· ${s.doc_number}` : ""}</p>
                        <p className="text-[12px] text-white/80 print:text-black truncate">{s.title}</p>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-widest shrink-0" style={{ color: SUBMITTAL_STATUS_COLOR[s.status] }}>{t(`submittalStatus.${s.status}`)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === "boq" && (
              <>
                <StatGrid stats={[
                  { label: t("reports.overallProgress"), value: `${boqOverallPct}%` },
                  { label: t("reports.total"), value: boqProgress.length },
                ]} />
                {boqProgress.length === 0 && <p className="text-white/30 text-sm">{t("reports.noEntriesInRange")}</p>}
                <div className="flex flex-col gap-2">
                  {boqProgress.map((b) => (
                    <div key={b.id} className={rowCls}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[12px] text-white/80 print:text-black truncate">{b.description}</p>
                        <span className="font-mono text-[11px] shrink-0" style={{ color: "#ff5100" }}>{b.pct}%</span>
                      </div>
                      <p className="font-mono text-[9px] text-white/30 print:text-black/50">{b.deliveredQty} / {b.quantity} {b.unit ?? ""}</p>
                      <div className="h-1.5 rounded-full bg-white/5 print:bg-black/10 mt-1.5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${b.pct}%`, backgroundColor: "#ff5100" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === "dashboard" && (
              <StatGrid stats={[
                { label: t("reports.planPercent"), value: `${Math.round(planPct)}%` },
                { label: t("reports.actualPercent"), value: actualPct != null ? `${Math.round(actualPct)}%` : "—" },
                { label: t("reports.openPunchItems"), value: openTasks.length },
                { label: t("reports.openSafetyIssues"), value: openSafety.length },
                { label: t("reports.pendingSubmittals"), value: pendingSubmittals.length },
                { label: t("reports.overallProgress"), value: `${boqOverallPct}%` },
                { label: t("equipmentStatus.Operational"), value: operationalEquipment.length },
                { label: t("reports.avgWorkforce"), value: avgWorkforce ?? "—" },
              ]} />
            )}

            {reportType === "photo" && (
              <>
                <StatGrid stats={[{ label: t("reports.total"), value: filteredPhotos.length }]} />
                {filteredPhotos.length === 0 && <p className="text-white/30 text-sm">{t("reports.noEntriesInRange")}</p>}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {filteredPhotos.map((p) => (
                    <div key={p.recordId + p.url} className="aspect-square rounded-xl overflow-hidden bg-white/5">
                      <img src={p.thumbUrl || p.url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
