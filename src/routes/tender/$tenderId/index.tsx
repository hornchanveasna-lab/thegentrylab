import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useTender, useTenderDocuments, useTenderRequirements, useTenderGaps, useTenderRisks,
  PROJECT_TYPE_LABELS, riskBand,
} from "@/lib/tender-data";
import { TenderShell, Card, StatusBadge, LoadingSpinner } from "@/components/tender/shared";

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-1">Documents</p>
          <p className="text-2xl font-extrabold font-mono">{docsProcessed}<span className="text-white/30 text-base">/{documents.length}</span></p>
          <p className="text-[10px] text-white/30 mt-0.5">processed</p>
        </Card>
        <Card>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-1">Requirements</p>
          <p className="text-2xl font-extrabold font-mono">{reqReady}<span className="text-white/30 text-base">/{requirements.length}</span></p>
          <p className="text-[10px] text-white/30 mt-0.5">ready</p>
        </Card>
        <Card>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-1">Critical Gaps</p>
          <p className="text-2xl font-extrabold font-mono" style={{ color: criticalGaps > 0 ? "#ef4444" : undefined }}>{criticalGaps}</p>
          <p className="text-[10px] text-white/30 mt-0.5">{highGaps} high</p>
        </Card>
        <Card>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-1">Deadline</p>
          <p className="text-lg font-extrabold font-mono">{tender.submission_deadline ? new Date(tender.submission_deadline).toLocaleDateString() : "—"}</p>
        </Card>
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
