import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart } from "recharts";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import { BackButton, Card, EmptyState, FieldSelect, ProjectPicker, StatusBadge, useSelectedProject, useCMTheme } from "@/components/cm/shared";
import {
  useCMContracts, useCMIPCs, useCMScheduleItems, buildCashFlowSCurve,
  type CMIPCStatus,
} from "@/lib/cm-data";

interface IPCListSearch { contract?: string }

export const Route = createFileRoute("/cm/ipc")({
  head: () => ({ meta: [{ title: "Interim Payment Certificates — Construction Management App" }] }),
  validateSearch: (search: Record<string, unknown>): IPCListSearch => ({
    contract: typeof search.contract === "string" ? search.contract : undefined,
  }),
  component: CMIPCPage,
});

const IPC_STATUS_COLOR: Record<CMIPCStatus, string> = {
  Draft: "#9ca3af",
  Submitted: "#fbbf24",
  Certified: "#34d399",
  Paid: "#60a5fa",
};

function CMIPCPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const theme = useCMTheme();
  const chartGrid = theme === "light" ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)";
  const chartTick = theme === "light" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.35)";
  const chartTooltipBg = theme === "light" ? "#ffffff" : "#181818";
  const chartTooltipBorder = theme === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)";
  const search = Route.useSearch();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: contracts } = useCMContracts(projectId || undefined);
  const { data: ipcs } = useCMIPCs(projectId || undefined);
  const { data: scheduleItems } = useCMScheduleItems(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "boq", "create");
  const [contractId, setContractId] = useState(search.contract ?? "");

  useEffect(() => {
    if (search.contract) setContractId(search.contract);
  }, [search.contract]);

  const activeContract = useMemo(() => (contracts ?? []).find((c) => c.id === contractId) ?? (contracts ?? [])[0], [contracts, contractId]);
  const contractIPCs = useMemo(() => (ipcs ?? []).filter((i) => i.contract_id === activeContract?.id), [ipcs, activeContract]);

  const series = useMemo(
    () => (activeContract ? buildCashFlowSCurve(activeContract, scheduleItems ?? [], contractIPCs) : []),
    [activeContract, scheduleItems, contractIPCs],
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
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-28">
        <div className="flex items-center gap-3 mb-6">
          <BackButton to="/cm" />
          <h1 className="text-xl font-extrabold tracking-tight text-white flex-1 truncate">{t("ipc.title")}</h1>
        </div>
        <p className="text-[12px] text-white/35 mb-5">{t("ipc.subtitle")}</p>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (contracts?.length ?? 0) > 0 && (
          <div className="mb-4">
            <FieldSelect
              value={activeContract?.id ?? ""} onChange={setContractId}
              options={(contracts ?? []).map((c) => ({ value: c.id, label: c.title }))}
              placeholder={t("ipc.selectContract")}
            />
          </div>
        )}

        {projectId && !activeContract && <EmptyState message={t("ipc.noContract")} />}

        {activeContract && (
          <>
            {series.length > 0 && (
              <Card title={t("ipc.cashFlow")}>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={series}>
                      <CartesianGrid stroke={chartGrid} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: chartTick, fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={40} />
                      <YAxis tick={{ fill: chartTick, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 12, fontSize: 11 }} />
                      <Area type="monotone" dataKey="plannedValue" name={t("ipc.planned")} fill="#ff510022" stroke="#ff5100" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="submittedValue" name={t("ipc.submitted")} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                      <Line type="monotone" dataKey="certifiedValue" name={t("ipc.certified")} stroke="#34d399" strokeWidth={2} dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between mt-5 mb-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("ipc.certificates")}</p>
              {canCreate && (
                <button onClick={() => navigate({ to: "/cm/ipc/new", search: { contract: activeContract.id } })}
                  className="px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest" style={{ color: "#ff5100" }}>
                  {t("ipc.new")}
                </button>
              )}
            </div>

            {contractIPCs.length === 0 && <EmptyState message={t("ipc.noneYet")} />}
            <div className="flex flex-col gap-2">
              {contractIPCs.map((ipc) => (
                <Link key={ipc.id} to="/cm/ipc/$id" params={{ id: ipc.id }}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#0d0d0e] px-4 py-3 hover:bg-white/3 transition-colors">
                  <div className="min-w-0">
                    <p className="text-[12px] text-white/80">{t("ipc.number")} {ipc.ipc_number}</p>
                    <p className="font-mono text-[10px] text-white/30">{ipc.period_start} → {ipc.period_end}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-[11px] text-white/50">{activeContract.currency ?? ""} {ipc.net_payable_this_period.toLocaleString()}</span>
                    <StatusBadge label={t(`ipcStatus.${ipc.status}`)} color={IPC_STATUS_COLOR[ipc.status]} />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
