import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleHeader, ProjectPicker, useSelectedProject, Card, inputCls } from "@/components/cm/shared";
import {
  useCMDailyLogs, useCMManpowerRoster, addCMManpowerRosterItem, removeCMManpowerRosterItem,
  type CMDailyLog,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/manpower")({
  head: () => ({ meta: [{ title: "Manpower Record — Construction Management App" }] }),
  component: CMManpowerPage,
});

const smallBtn = "px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest transition-all";

function dailyHeadcount(log: CMDailyLog) {
  return log.manpower.reduce((s, m) => s + m.count, 0);
}

/** A predefined per-project list of trade/company pairs Site Diary picks
 *  from instead of retyping every day — the roster itself carries no
 *  headcount; that's still entered fresh per day in Site Diary and
 *  aggregated live above, same as before. */
function ManpowerRosterSection({ ownerId, projectId }: { ownerId: string; projectId: string }) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: roster } = useCMManpowerRoster(projectId);
  const [adding, setAdding] = useState(false);
  const [trade, setTrade] = useState("");
  const [company, setCompany] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_manpower_roster", projectId] });

  const handleAdd = async () => {
    if (!trade.trim()) return;
    await addCMManpowerRosterItem(ownerId, projectId, trade.trim(), company.trim() || null);
    setTrade(""); setCompany(""); setAdding(false);
    invalidate();
  };

  return (
    <Card title={t("manpower.roster")}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(roster ?? []).map((r) => (
            <span key={r.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[10px] bg-white/[0.05] text-white/60">
              {r.company ? `${r.company} — ` : ""}{r.trade}
              <button onClick={() => removeCMManpowerRosterItem(r.id).then(invalidate)} className="text-white/25 hover:text-red-400 w-4 h-4 rounded-full flex items-center justify-center">×</button>
            </span>
          ))}
        </div>
        {(roster?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">{t("manpower.noRoster")}</p>}
        {adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder={t("siteDiary.trade")} value={trade} onChange={(e) => setTrade(e.target.value)} />
              <input className={inputCls} placeholder={t("siteDiary.company")} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={!trade.trim()} className={`${smallBtn} disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("manpower.addRosterItem")}</button>
        )}
      </div>
    </Card>
  );
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
            <div className="mb-4">
              <ManpowerRosterSection ownerId={user.id} projectId={projectId} />
            </div>
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
