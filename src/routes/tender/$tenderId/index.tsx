import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useTender, useTenderDocuments, useTenderRequirements, useTenderGaps, useTenderRisks,
  PROJECT_TYPE_LABELS, riskBand,
} from "@/lib/tender-data";
import { TenderShell, Card, KpiPanel, KpiTile, StatusBadge, LoadingSpinner } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/")({
  component: TenderOverview,
});

function TenderOverview() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: tender, isLoading } = useTender(tenderId);
  const { data: documents = [] } = useTenderDocuments(tenderId);
  const { data: requirements = [] } = useTenderRequirements(tenderId);
  const { data: gaps = [] } = useTenderGaps(tenderId);
  const { data: risks = [] } = useTenderRisks(tenderId);

  if (!user) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (isLoading || !tender) return <div className="min-h-screen bg-[#0a0a0b]"><LoadingSpinner /></div>;

  const docsProcessed = documents.filter((d) => d.status === "processed").length;
  const reqReady = requirements.filter((r) => r.status === "ready" || r.status === "approved").length;
  const criticalGaps = gaps.filter((g) => g.severity === "critical" && !g.resolved).length;
  const highGaps = gaps.filter((g) => g.severity === "high" && !g.resolved).length;
  const topRisks = risks.slice(0, 5);

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

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Top risks">
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

        <Card title="AI alerts">
          {documents.length === 0 ? (
            <p className="text-[12px] text-white/30">Upload the tender package to get started.</p>
          ) : criticalGaps === 0 && highGaps === 0 ? (
            <p className="text-[12px] text-white/30">No critical or high-severity gaps flagged.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {gaps.filter((g) => !g.resolved && (g.severity === "critical" || g.severity === "high")).slice(0, 6).map((g) => (
                <div key={g.id} className="flex items-start gap-2">
                  <StatusBadge value={g.severity} />
                  <p className="text-[12px] text-white/70 flex-1">{g.description}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </TenderShell>
  );
}
