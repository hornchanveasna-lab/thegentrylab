import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { useCMProjects, useCMDailyLogs, useCMDailyActivityRange } from "@/lib/cm-data";
import { FieldSelect, CMDailyActivityList, MODULE_ROUTES, setPendingHighlight } from "@/components/cm/shared";

export const Route = createFileRoute("/cm/reports")({
  head: () => ({ meta: [{ title: "Reports — Construction Management App" }] }),
  component: CMReportsPage,
});

const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function CMReportsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const { data: projects } = useCMProjects(user?.id);
  const [projectId, setProjectId] = useState<string>("");
  const [fromDate, setFromDate] = useState(() => isoDaysAgo(7));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { data: logs, isLoading: logsLoading } = useCMDailyLogs(projectId || undefined);
  const { data: activityByDate } = useCMDailyActivityRange(projectId || undefined, fromDate, toDate);

  const activeProject = (projects ?? []).find((p) => p.id === projectId);
  const filtered = useMemo(
    () => (logs ?? []).filter((l) => l.log_date >= fromDate && l.log_date <= toDate).sort((a, b) => a.log_date.localeCompare(b.log_date)),
    [logs, fromDate, toDate],
  );

  const totalPhotos = filtered.reduce((sum, l) => sum + l.photos.length, 0);
  const manpowerDays = filtered.filter((l) => l.manpower.length > 0);
  const avgWorkforce = manpowerDays.length
    ? Math.round(manpowerDays.reduce((s, l) => s + l.manpower.reduce((ms, m) => ms + m.count, 0), 0) / manpowerDays.length)
    : null;
  const totalDelayHours = filtered.reduce((sum, l) => sum + l.delays.reduce((ds, d) => ds + d.hours_lost, 0), 0);
  const latestProgress = [...filtered].reverse().find((l) => l.progress_pct != null)?.progress_pct ?? null;

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
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-16">
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
                <p className="font-mono text-[11px] text-white/40 print:text-black/60 mt-0.5">{fromDate} → {toDate}</p>
              </div>
              <button onClick={() => window.print()} className="px-4 py-2 rounded-full text-[10px] font-mono uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-colors print:hidden">
                {t("reports.print")}
              </button>
            </div>

            {logsLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}

            {!logsLoading && (
              <div className="grid grid-cols-2 gap-3 print:border print:border-black/10 print:rounded-none">
                {[
                  { label: t("reports.diaryEntries"), value: filtered.length },
                  { label: t("reports.avgWorkforce"), value: avgWorkforce ?? "—" },
                  { label: t("reports.latestProgress"), value: latestProgress != null ? `${latestProgress}%` : "—" },
                  { label: t("reports.delayHours"), value: totalDelayHours > 0 ? totalDelayHours : "—" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl bg-[#0d0d0e] print:bg-white print:border print:border-black/10 px-3 py-3 text-center">
                    <p className="text-lg font-extrabold print:text-black">{s.value}</p>
                    <p className="font-mono text-[8px] uppercase tracking-widest text-white/30 print:text-black/50 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {!logsLoading && totalPhotos > 0 && <p className="text-[12px] text-white/40 print:text-black/60">{totalPhotos} {t("reports.photosLogged")}</p>}

            {!logsLoading && filtered.length === 0 && <p className="text-white/30 text-sm">{t("reports.noEntriesInRange")}</p>}

            <div className="flex flex-col gap-2">
              {filtered.map((l) => (
                <div key={l.id} className="rounded-2xl bg-[#0d0d0e] print:bg-white print:border print:border-black/10 px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-white/70 print:text-black">{l.log_date}</span>
                    {l.progress_pct != null && <span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{l.progress_pct}%</span>}
                  </div>
                  {l.weather && <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 print:text-black/50 mb-1">{t(`weather.${l.weather}`)}{l.manpower.length > 0 ? ` · ${l.manpower.reduce((s, m) => s + m.count, 0)} ${t("reports.workers")}` : ""}</p>}
                  {l.activities && <p className="text-[12px] text-white/60 print:text-black/80">{l.activities}</p>}
                  {l.issues && <p className="text-[11px] text-red-400/80 print:text-red-700 mt-1">{t("reports.issue")} {l.issues}</p>}
                  <div className="print:hidden mt-2">
                    <CMDailyActivityList activity={activityByDate?.get(l.log_date)} projectId={l.project_id}
                      onOpenItem={(module, recordId, projectId) => {
                        setPendingHighlight(module, recordId, projectId, "");
                        navigate({ to: MODULE_ROUTES[module] });
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
