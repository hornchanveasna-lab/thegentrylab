import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import { FormPage, Card, StatusBadge, ConfirmationDialog, labelCls } from "@/components/cm/shared";
import {
  useCMIPC, useCMIPCLineItems, useCMContracts, useActiveCMBOQItems, useCMDailyLogs,
  submitCMIPC, certifyCMIPC, payCMIPC,
  type CMIPCStatus,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/ipc_/$id")({
  component: IPCDetailPage,
});

const IPC_STATUS_COLOR: Record<CMIPCStatus, string> = {
  Draft: "#9ca3af",
  Submitted: "#fbbf24",
  Certified: "#34d399",
  Paid: "#60a5fa",
};

function IPCDetailPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: ipc } = useCMIPC(id);
  const { data: lineItems } = useCMIPCLineItems(id);
  const { data: contracts } = useCMContracts(ipc?.project_id);
  const { data: boqItems } = useActiveCMBOQItems(ipc?.project_id);
  const { data: logs } = useCMDailyLogs(ipc?.project_id);
  const canEdit = usePermission(ipc?.project_id, user?.id, "boq", "edit");
  const [certifiedQty, setCertifiedQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"submit" | "certify" | "pay" | null>(null);

  const contract = contracts?.find((c) => c.id === ipc?.contract_id);
  const boqById = useMemo(() => new Map((boqItems ?? []).map((b) => [b.id, b])), [boqItems]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cm_ipc", id] });
    qc.invalidateQueries({ queryKey: ["cm_ipc_line_items", id] });
    qc.invalidateQueries({ queryKey: ["cm_ipcs", ipc?.project_id] });
    qc.invalidateQueries({ queryKey: ["cm_daily_logs", ipc?.project_id] });
  };

  const runAction = async () => {
    if (!ipc || !user) return;
    setBusy(true);
    try {
      if (confirmAction === "submit") await submitCMIPC(ipc.id, ipc.project_id, user.id, ipc.ipc_number);
      if (confirmAction === "pay") await payCMIPC(ipc.id, ipc.project_id, user.id, ipc.ipc_number);
      if (confirmAction === "certify") {
        const certifiedMap = new Map<string, number>();
        for (const line of lineItems ?? []) {
          const raw = certifiedQty[line.id];
          certifiedMap.set(line.id, raw !== undefined && raw !== "" ? Number(raw) : line.claimed_quantity);
        }
        await certifyCMIPC(ipc, lineItems ?? [], certifiedMap, logs ?? [], user.id);
      }
      invalidate();
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !ipc) return null;

  const currency = contract?.currency ?? "";

  return (
    <FormPage title={`${t("ipc.number")} ${ipc.ipc_number}`} backTo="/cm/ipc">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-white/50">{contract?.title ?? ""}</p>
          <StatusBadge label={t(`ipcStatus.${ipc.status}`)} color={IPC_STATUS_COLOR[ipc.status]} size="sm" />
        </div>

        <Card title={t("ipc.summary")}>
          <div className="flex flex-col gap-2 text-[12px]">
            <div className="flex justify-between"><span className="text-white/40">{t("ipc.period")}</span><span className="text-white/80">{ipc.period_start} → {ipc.period_end}</span></div>
            <div className="flex justify-between"><span className="text-white/40">{t("ipc.grossValue")}</span><span className="text-white/80 font-mono">{currency} {ipc.gross_value_this_period.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-white/40">{t("ipc.cumulativeGross")}</span><span className="text-white/80 font-mono">{currency} {ipc.cumulative_gross_to_date.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-white/40">{t("ipc.retentionHeld")}</span><span className="text-white/80 font-mono">{currency} {ipc.retention_held_this_period.toLocaleString()} ({ipc.retention_pct}%)</span></div>
            {ipc.advance_recovery_this_period > 0 && (
              <div className="flex justify-between"><span className="text-white/40">{t("ipc.advanceRecovery")}</span><span className="text-white/80 font-mono">{currency} {ipc.advance_recovery_this_period.toLocaleString()}</span></div>
            )}
            {ipc.other_deductions.map((d, i) => (
              <div key={i} className="flex justify-between"><span className="text-white/40">{d.description}</span><span className="text-white/80 font-mono">{currency} {d.amount.toLocaleString()}</span></div>
            ))}
            <div className="flex justify-between pt-2 border-t border-white/6"><span className="text-white/60 font-bold">{t("ipc.netPayable")}</span><span className="font-mono font-bold" style={{ color: "#ff5100" }}>{currency} {ipc.net_payable_this_period.toLocaleString()}</span></div>
            {ipc.certified_value != null && (
              <div className="flex justify-between"><span className="text-white/40">{t("ipc.certifiedValue")}</span><span className="text-white/80 font-mono">{currency} {ipc.certified_value.toLocaleString()}</span></div>
            )}
          </div>
        </Card>

        <Card title={t("ipc.lineItems")}>
          <div className="flex flex-col gap-2">
            {(lineItems ?? []).map((line) => {
              const boq = boqById.get(line.boq_item_id);
              return (
                <div key={line.id} className="rounded-xl bg-white/3 px-3 py-2.5 flex flex-col gap-1.5">
                  <p className="text-[12px] text-white/80 truncate">{boq?.description ?? line.boq_item_id}</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] text-white/35">{t("ipc.claimedQty")} {line.claimed_quantity} {boq?.unit ?? ""} @ {currency} {line.unit_cost_snapshot}</span>
                    {ipc.status === "Submitted" && canEdit ? (
                      <input type="number" step="0.01" className="w-24 bg-white/8 rounded-full px-3 py-1.5 text-[11px] font-mono text-white/85 text-right focus:outline-none"
                        placeholder={String(line.claimed_quantity)}
                        value={certifiedQty[line.id] ?? ""} onChange={(e) => setCertifiedQty({ ...certifiedQty, [line.id]: e.target.value })} />
                    ) : line.certified_quantity != null ? (
                      <span className="font-mono text-[10px] text-emerald-400">{t("ipc.certifiedQty")} {line.certified_quantity}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {(lineItems?.length ?? 0) === 0 && <p className="text-white/30 text-[12px]">{t("ipc.noLineItems")}</p>}
          </div>
        </Card>

        {canEdit && (
          <div className="flex flex-col gap-2">
            {ipc.status === "Draft" && (
              <button onClick={() => setConfirmAction("submit")} disabled={busy}
                className="w-full py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold disabled:opacity-40" style={{ backgroundColor: "#ff5100" }}>
                {t("ipc.actionSubmit")}
              </button>
            )}
            {ipc.status === "Submitted" && (
              <button onClick={() => setConfirmAction("certify")} disabled={busy}
                className="w-full py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold disabled:opacity-40" style={{ backgroundColor: "#ff5100" }}>
                {t("ipc.actionCertify")}
              </button>
            )}
            {ipc.status === "Certified" && (
              <button onClick={() => setConfirmAction("pay")} disabled={busy}
                className="w-full py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold disabled:opacity-40" style={{ backgroundColor: "#ff5100" }}>
                {t("ipc.actionPay")}
              </button>
            )}
          </div>
        )}
        <p className={labelCls}>{t("ipc.noBackHint")}</p>
      </div>

      {confirmAction && (
        <ConfirmationDialog
          message={t(`ipc.confirm${confirmAction === "submit" ? "Submit" : confirmAction === "certify" ? "Certify" : "Pay"}`)}
          confirmLabel={t(`ipc.action${confirmAction === "submit" ? "Submit" : confirmAction === "certify" ? "Certify" : "Pay"}`)}
          destructive={false} onConfirm={runAction} onCancel={() => setConfirmAction(null)}
        />
      )}
    </FormPage>
  );
}
