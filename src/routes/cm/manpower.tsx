import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleHeader, ProjectPicker, useSelectedProject } from "@/components/cm/shared";
import { useCMDailyLogs, type CMDailyLog } from "@/lib/cm-data";

export const Route = createFileRoute("/cm/manpower")({
  head: () => ({ meta: [{ title: "Manpower Record — Construction Management App" }] }),
  component: CMManpowerPage,
});

function dailyHeadcount(log: CMDailyLog) {
  return log.manpower.reduce((s, m) => s + m.count, 0);
}

function CMManpowerPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: logs, isLoading } = useCMDailyLogs(projectId || undefined);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const daysWithManpower = useMemo(() => {
    let list = (logs ?? []).filter((l) => l.manpower.length > 0);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((l) => l.manpower.some((m) => [m.trade, m.company].some((f) => f?.toLowerCase().includes(q))));
    list = [...list].sort((a, b) => a.log_date.localeCompare(b.log_date));
    return sortAsc ? list : [...list].reverse();
  }, [logs, search, sortAsc]);

  const chartData = useMemo(
    () => [...(logs ?? [])].sort((a, b) => a.log_date.localeCompare(b.log_date)).map((l) => ({ date: l.log_date, headcount: dailyHeadcount(l) })),
    [logs],
  );

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
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pb-28">
        <ModuleHeader title={t("manpower.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <p className="text-[12px] text-white/35 mb-5">{t("manpower.subtitle")}</p>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && chartData.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("manpower.nothingYet")}</p>
              </div>
            )}
            {!isLoading && chartData.length > 0 && (
              <div className="rounded-2xl bg-[#0d0d0e] p-4 mb-4" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip contentStyle={{ background: "#181818", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 11 }}
                      labelStyle={{ color: "rgba(255,255,255,0.8)" }} />
                    <Bar dataKey="headcount" name={t("manpower.headcount")} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {daysWithManpower.map((log) => (
                <div key={log.id} className="rounded-2xl bg-[#0d0d0e] px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[11px] text-white/70">{log.log_date}</span>
                    <span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{t("manpower.total")} {dailyHeadcount(log)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {log.manpower.map((m, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-[10px] bg-white/[0.05] text-white/60">
                        {m.company ? `${m.company} — ` : ""}{m.trade}: {m.count}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
