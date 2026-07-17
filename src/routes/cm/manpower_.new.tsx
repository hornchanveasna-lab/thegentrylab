import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { ManpowerEntryFormPage, useSelectedProject } from "@/components/cm/shared";
import {
  useCMDailyLogs, useCMManpowerRoster, useCMProjectSubcontractors,
  findOrCreateCMDailyLog, updateCMDailyLog, logCMActivity,
} from "@/lib/cm-data";
import { DEFAULT_TRADES, todayStr } from "./manpower";

interface CMManpowerNewSearch {
  date?: string;
}

export const Route = createFileRoute("/cm/manpower_/new")({
  validateSearch: (search: Record<string, unknown>): CMManpowerNewSearch => ({
    date: typeof search.date === "string" ? search.date : undefined,
  }),
  component: NewManpowerEntryPage,
});

function NewManpowerEntryPage() {
  const { date: searchDate } = Route.useSearch();
  const date = searchDate || todayStr();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const { data: logs } = useCMDailyLogs(projectId || undefined);
  const { data: roster } = useCMManpowerRoster(projectId || undefined);
  const { data: subcontractors } = useCMProjectSubcontractors(projectId || undefined);

  const dayLog = useMemo(() => (logs ?? []).find((l) => l.log_date === date), [logs, date]);
  const rows = dayLog?.manpower ?? [];

  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of roster ?? []) if (r.company) set.add(r.company);
    for (const s of subcontractors ?? []) if (s.contact.company) set.add(s.contact.company);
    for (const l of logs ?? []) for (const m of l.manpower) if (m.company) set.add(m.company);
    return [...set].sort();
  }, [roster, subcontractors, logs]);

  const tradeOptions = useMemo(() => {
    const set = new Set<string>([...DEFAULT_TRADES, ...(activeProject?.manpower_default_trades ?? [])]);
    for (const r of roster ?? []) set.add(r.trade);
    for (const s of subcontractors ?? []) if (s.contact.trade) set.add(s.contact.trade);
    for (const l of logs ?? []) for (const m of l.manpower) if (m.trade) set.add(m.trade);
    return [...set].sort();
  }, [roster, subcontractors, logs, activeProject]);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <ManpowerEntryFormPage
      ownerId={user.id}
      projectId={projectId}
      rows={rows}
      editIndex={null}
      companyOptions={companyOptions}
      tradeOptions={tradeOptions}
      backTo="/cm/manpower"
      onSave={async (next) => {
        const log = dayLog ?? await findOrCreateCMDailyLog(user.id, projectId, date);
        await updateCMDailyLog(log.id, { manpower: next });
        queryClient.invalidateQueries({ queryKey: ["cm_daily_logs", projectId] });
        logCMActivity(projectId, user.id, "manpower_added", "manpower", log.id, { date, entries: next.length });
        navigate({ to: "/cm/manpower" });
      }}
      onClose={() => navigate({ to: "/cm/manpower" })}
    />
  );
}
