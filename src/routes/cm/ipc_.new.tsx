import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { FormPage, FieldSelect, inputCls, labelCls, useSelectedProject } from "@/components/cm/shared";
import {
  useCMContracts, useActiveCMBOQItems, useCMDailyLogs, useCMIPCs, createCMIPC,
  type CMIPCDeductionRow,
} from "@/lib/cm-data";

interface IPCNewSearch { contract?: string }

export const Route = createFileRoute("/cm/ipc_/new")({
  validateSearch: (search: Record<string, unknown>): IPCNewSearch => ({
    contract: typeof search.contract === "string" ? search.contract : undefined,
  }),
  component: NewIPCPage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function NewIPCPage() {
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const search = Route.useSearch();
  const { data: contracts } = useCMContracts(projectId || undefined);
  const { data: boqItems } = useActiveCMBOQItems(projectId || undefined);
  const { data: logs } = useCMDailyLogs(projectId || undefined);
  const { data: previousIPCs } = useCMIPCs(projectId || undefined);

  const [contractId, setContractId] = useState(search.contract ?? "");
  const [periodStart, setPeriodStart] = useState(firstOfMonth());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [retentionPct, setRetentionPct] = useState("10");
  const [advanceRecovery, setAdvanceRecovery] = useState("0");
  const [deductions, setDeductions] = useState<CMIPCDeductionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractId || !projectId || !activeProject || !user || saving) return;
    setSaving(true);
    setError("");
    try {
      const ipc = await createCMIPC(
        activeProject.owner_id, projectId, contractId, periodStart, periodEnd,
        boqItems ?? [], logs ?? [], (previousIPCs ?? []).filter((i) => i.contract_id === contractId),
        { retentionPct: Number(retentionPct) || 0, advanceRecovery: Number(advanceRecovery) || 0, otherDeductions: deductions },
      );
      queryClient.invalidateQueries({ queryKey: ["cm_ipcs", projectId] });
      navigate({ to: "/cm/ipc/$id", params: { id: ipc.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create IPC");
      setSaving(false);
    }
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <FormPage title={t("ipc.new")} backTo="/cm/ipc">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("ipc.contract")}</span>
          <FieldSelect value={contractId} onChange={setContractId} options={(contracts ?? []).map((c) => ({ value: c.id, label: c.title }))} placeholder={t("ipc.selectContract")} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("ipc.periodStart")}</span>
            <input type="date" className={inputCls} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("ipc.periodEnd")}</span>
            <input type="date" className={inputCls} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} disabled={saving} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("ipc.retentionPct")}</span>
            <input type="number" min={0} max={100} step="0.5" className={inputCls} value={retentionPct} onChange={(e) => setRetentionPct(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("ipc.advanceRecovery")}</span>
            <input type="number" min={0} step="0.01" className={inputCls} value={advanceRecovery} onChange={(e) => setAdvanceRecovery(e.target.value)} disabled={saving} />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <span className={labelCls}>{t("ipc.otherDeductions")}</span>
          {deductions.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${inputCls} flex-1`} placeholder={t("ipc.deductionDescription")} value={d.description}
                onChange={(e) => setDeductions(deductions.map((row, ri) => (ri === i ? { ...row, description: e.target.value } : row)))} disabled={saving} />
              <input type="number" step="0.01" className={`${inputCls} w-28`} placeholder={t("ipc.deductionAmount")} value={d.amount}
                onChange={(e) => setDeductions(deductions.map((row, ri) => (ri === i ? { ...row, amount: Number(e.target.value) || 0 } : row)))} disabled={saving} />
              <button type="button" onClick={() => setDeductions(deductions.filter((_, ri) => ri !== i))} className="text-white/25 hover:text-red-400 w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
            </div>
          ))}
          <button type="button" onClick={() => setDeductions([...deductions, { description: "", amount: 0 }])}
            className="self-start font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("ipc.addDeduction")}</button>
        </div>
        <p className="text-[11px] text-white/35">{t("ipc.newHint")}</p>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !contractId}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("ipc.creating") : t("ipc.createDraft")}
        </button>
      </form>
    </FormPage>
  );
}
