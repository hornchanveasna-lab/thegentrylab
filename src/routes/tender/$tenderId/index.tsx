import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useTender, useTenderDocuments, useTenderRequirements, useTenderChecklist, useTenderGaps, useTenderRisks,
  PROJECT_TYPE_LABELS, riskBand,
} from "@/lib/tender-data";
import { TenderShell, Card, KpiPanel, KpiTile, StatusBadge, LoadingSpinner } from "@/components/tender/shared";

interface AttentionBucket {
  key: string;
  label: string;
  count: number;
  severity: "critical" | "high" | "medium";
  to: string;
}

export const Route = createFileRoute("/tender/$tenderId/")({
  component: TenderOverview,
});

function TenderOverview() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: tender, isLoading } = useTender(tenderId);
  const { data: documents = [] } = useTenderDocuments(tenderId);
  const { data: requirements = [] } = useTenderRequirements(tenderId);
  const { data: checklist = [] } = useTenderChecklist(tenderId);
  const { data: gaps = [] } = useTenderGaps(tenderId);
  const { data: risks = [] } = useTenderRisks(tenderId);

  if (!user) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (isLoading || !tender) return <div className="min-h-screen bg-[#0a0a0b]"><LoadingSpinner /></div>;

  const docsProcessed = documents.filter((d) => d.status === "processed").length;
  const reqReady = requirements.filter((r) => r.status === "ready" || r.status === "approved").length;
  const criticalGaps = gaps.filter((g) => g.severity === "critical" && !g.resolved).length;
  const highGaps = gaps.filter((g) => g.severity === "high" && !g.resolved).length;
  const missingReqs = requirements.filter((r) => r.status === "missing_info").length;
  const missingChecklist = checklist.filter((c) => c.status === "missing_information").length;
  const topRisks = risks.slice(0, 5);

  // Prioritized attention feed — only counts we can actually justify from real
  // status fields (no invented "needs action" state for anything else, e.g.
  // clarifications only track selected_for_export, not a resolved/unresolved
  // concept, so they're intentionally left out here).
  const attention: AttentionBucket[] = [
    criticalGaps > 0 && { key: "critical-gaps", label: "Critical gaps", count: criticalGaps, severity: "critical", to: "/tender/$tenderId/gaps" },
    highGaps > 0 && { key: "high-gaps", label: "High-severity gaps", count: highGaps, severity: "high", to: "/tender/$tenderId/gaps" },
    missingReqs > 0 && { key: "missing-reqs", label: "Requirements missing information", count: missingReqs, severity: "high", to: "/tender/$tenderId/requirements" },
    missingChecklist > 0 && { key: "missing-checklist", label: "Checklist items missing information", count: missingChecklist, severity: "medium", to: "/tender/$tenderId/checklist" },
  ].filter((b): b is AttentionBucket => !!b);

  return (
    <TenderShell
      tenderId={tenderId}
      title={tender.name}
      subtitle={
        <span>
          {tender.client && <>{tender.client} · </>}
          {tender.location && <>{tender.location} · </>}
          {tender.project_type && PROJECT_TYPE_LABELS[tender.project_type]}
        </span>
      }
      action={<StatusBadge value={tender.status} />}
    >
      <div className="mb-4">
        <KpiPanel title="Project Health">
          <KpiTile
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6" /></svg>}
            value={<>{docsProcessed}<span className="text-white/30 text-sm">/{documents.length}</span></>}
            label="Documents processed"
          />
          <KpiTile
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12.5l2.5 2.5L16 9" /></svg>}
            value={<>{reqReady}<span className="text-white/30 text-sm">/{requirements.length}</span></>}
            label="Requirements ready"
            color="#22c55e"
          />
          <KpiTile
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4" /></svg>}
            value={criticalGaps}
            label={`Critical gaps · ${highGaps} high`}
            color="#ef4444"
          />
          <KpiTile
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>}
            value={tender.submission_deadline ? new Date(tender.submission_deadline).toLocaleDateString() : "—"}
            label="Submission deadline"
            color="#f97316"
          />
        </KpiPanel>
      </div>

      <div className="mb-4">
        <Card title="Attention required">
          {documents.length === 0 ? (
            <p className="text-[12px] text-white/30">Upload the tender package to get started.</p>
          ) : attention.length === 0 ? (
            <p className="text-[12px] text-white/30">Nothing needs attention right now.</p>
          ) : (
            <div className="flex flex-col divide-y divide-white/6">
              {attention.map((b) => (
                <Link key={b.key} to={b.to} params={{ tenderId }}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded-lg">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StatusBadge value={b.severity} />
                    <p className="text-[12px] text-white/80 truncate">{b.label}</p>
                  </div>
                  <span className="font-mono text-[13px] font-bold text-white/60 shrink-0">{b.count}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Top risks" action={<Link to="/tender/$tenderId/risks" params={{ tenderId }} className="font-mono text-[10px] uppercase tracking-widest text-[#2563eb]">View all →</Link>}>
          {topRisks.length === 0 ? (
            <p className="text-[12px] text-white/30">No risks identified yet — run the Risk Register once documents are processed.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {topRisks.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3">
                  <p className="text-[12px] text-white/70 flex-1">{r.description}</p>
                  <StatusBadge value={riskBand(r.risk_score).toLowerCase()} label={`${riskBand(r.risk_score)} (${r.risk_score})`} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Requirements by status">
          {requirements.length === 0 ? (
            <p className="text-[12px] text-white/30">No requirements extracted yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {(["open", "in_progress", "missing_info", "ready", "approved"] as const).map((s) => {
                const count = requirements.filter((r) => r.status === s).length;
                if (count === 0) return null;
                return (
                  <div key={s} className="flex items-center justify-between gap-3">
                    <StatusBadge value={s} />
                    <span className="font-mono text-[12px] text-white/60">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </TenderShell>
  );
}
