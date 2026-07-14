import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { BackButton, Card, ProjectPicker, useSelectedProject, useCMTheme } from "@/components/cm/shared";
import {
  useCMProject,
  useCMDailyLogs,
  useCMScheduleItems,
  useActiveCMBOQItems,
  useCMEquipment,
  buildSCurveSeries,
  scheduleItemPlanPercent,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/dashboard")({
  head: () => ({ meta: [{ title: "Project Dashboard — Construction Management App" }] }),
  component: CMDashboardPage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function CMDashboardPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const theme = useCMTheme();
  const chartGrid = theme === "light" ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)";
  const chartTick = theme === "light" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.35)";
  const chartTooltipBg = theme === "light" ? "#ffffff" : "#181818";
  const chartTooltipBorder = theme === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)";
  const chartTooltipLabel = theme === "light" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)";
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: project } = useCMProject(projectId || undefined);
  const { data: logs } = useCMDailyLogs(projectId || undefined);
  const { data: scheduleItems } = useCMScheduleItems(projectId || undefined);
  const { data: boqItems } = useActiveCMBOQItems(projectId || undefined);
  const { data: equipment } = useCMEquipment(projectId || undefined);

  const series = useMemo(
    () => (project ? buildSCurveSeries(project, logs ?? [], scheduleItems ?? []) : []),
    [project, logs, scheduleItems],
  );

  const todayStr = today();
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

  const boqTotal = (boqItems ?? []).reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of boqItems ?? []) {
      const key = item.category ?? t("boq.uncategorized");
      map.set(key, (map.get(key) ?? 0) + item.quantity * item.unit_cost);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [boqItems, t]);

  const scheduleBuckets = useMemo(() => {
    let ahead = 0, onTrack = 0, behind = 0;
    for (const item of scheduleItems ?? []) {
      const plan = scheduleItemPlanPercent(item, todayStr);
      const diff = item.actual_percent - plan;
      if (diff >= 3) ahead++;
      else if (diff <= -3) behind++;
      else onTrack++;
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

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()} className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>{t("common.signInGoogle")}</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <BackButton to="/cm" />
          <h1 className="text-xl font-extrabold tracking-tight text-white">{t("dashboard.title")}</h1>
        </div>

        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {!projectId && <p className="text-white/30 text-sm">{t("dashboard.selectProject")}</p>}

        {projectId && project && (
          <div className="flex flex-col gap-4">
            <Card title={t("dashboard.overview")}>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1">{t("dashboard.planToday")}</p>
                  <p className="text-white/80 font-bold">{planPct.toFixed(0)}%</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1">{t("dashboard.actualLatest")}</p>
                  <p className="text-white/80 font-bold">{actualPct != null ? `${actualPct.toFixed(0)}%` : "—"}</p>
                </div>
                {daysElapsed != null && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1">{t("dashboard.daysElapsed")}</p>
                    <p className="text-white/80 font-bold">{daysElapsed}</p>
                  </div>
                )}
                {daysRemaining != null && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1">{t("dashboard.daysRemaining")}</p>
                    <p className="text-white/80 font-bold">{daysRemaining}</p>
                  </div>
                )}
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${varianceColor}18` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: varianceColor }} />
                <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: varianceColor }}>{varianceLabel}</span>
              </div>
            </Card>

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
                      <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 12, fontSize: 11 }}
                        labelStyle={{ color: chartTooltipLabel }} />
                      <Legend wrapperStyle={{ fontSize: 10, color: chartTick }} />
                      <Bar yAxisId="left" dataKey="manpower" name={t("dashboard.manpowerLegend")} fill="#94a3b8" fillOpacity={0.5} radius={[2, 2, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="plan" name={t("dashboard.planLegend")} stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="actual" name={t("dashboard.actualLegend")} stroke="#ff5100" strokeWidth={2} dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title={t("dashboard.boqSummary")}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("dashboard.totalValue")}</span>
                <span className="font-mono text-[13px] font-bold" style={{ color: "#ff5100" }}>{boqTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {topCategories.map(([category, value]) => (
                  <div key={category} className="flex items-center justify-between text-[12px]">
                    <span className="text-white/60 truncate">{category}</span>
                    <span className="font-mono text-white/40 shrink-0">{boqTotal > 0 ? ((value / boqTotal) * 100).toFixed(1) : "0.0"}%</span>
                  </div>
                ))}
              </div>
              <Link to="/cm/boq" className="inline-block mt-3 font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("dashboard.viewBoq")}</Link>
            </Card>

            <Card title={t("dashboard.scheduleSummary")}>
              <div className="flex items-center gap-4">
                <div><p className="font-bold text-[14px]" style={{ color: "#34d399" }}>{scheduleBuckets.ahead}</p><p className="font-mono text-[9px] text-white/30">{t("dashboard.statusAhead")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#fbbf24" }}>{scheduleBuckets.onTrack}</p><p className="font-mono text-[9px] text-white/30">{t("dashboard.statusOnTrack")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#f43f5e" }}>{scheduleBuckets.behind}</p><p className="font-mono text-[9px] text-white/30">{t("dashboard.statusBehind")}</p></div>
              </div>
              <Link to="/cm/schedule" className="inline-block mt-3 font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("dashboard.viewSchedule")}</Link>
            </Card>

            <Card title={t("dashboard.manpowerCard")}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("dashboard.latestHeadcount")}</span>
                <span className="font-bold text-[14px] text-white/80">{latestHeadcount}</span>
              </div>
              <Link to="/cm/manpower" className="inline-block mt-3 font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("dashboard.viewManpower")}</Link>
            </Card>

            <Card title={t("dashboard.equipmentCard")}>
              <div className="flex items-center gap-4">
                <div><p className="font-bold text-[14px]" style={{ color: "#34d399" }}>{equipmentCounts.Operational}</p><p className="font-mono text-[9px] text-white/30">{t("equipmentStatus.Operational")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#fbbf24" }}>{equipmentCounts.Maintenance}</p><p className="font-mono text-[9px] text-white/30">{t("equipmentStatus.Maintenance")}</p></div>
                <div><p className="font-bold text-[14px]" style={{ color: "#f43f5e" }}>{equipmentCounts["Out of Service"]}</p><p className="font-mono text-[9px] text-white/30">{t("equipmentStatus.Out of Service")}</p></div>
              </div>
              <Link to="/cm/equipment" className="inline-block mt-3 font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("dashboard.viewEquipment")}</Link>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
