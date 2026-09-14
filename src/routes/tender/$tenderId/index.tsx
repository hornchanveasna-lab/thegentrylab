import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useTender, useTenderDocuments, useTenderRequirements, useTenderChecklist, useTenderGaps, useTenderRisks,
  PROJECT_TYPE_LABELS, riskBand,
} from "@/lib/tender-data";
import {
  TenderShell, Card, KpiPanel, KpiTile, StatusBadge, LoadingSpinner, PageLoading,
  deadlineUrgency, formatDate, statusColor, linkCls, humanize,
} from "@/components/tender/shared";

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

  if (!user) return <PageLoading />;
  if (isLoading || !tender) return <div className="min-h-screen bg-white"><LoadingSpinner /></div>;

  const docsProcessed = documents.filter((d) => d.status === "processed").length;
  const reqReady = requirements.filter((r) => r.status === "ready" || r.status === "approved").length;
  const criticalGaps = gaps.filter((g) => g.severity === "critical" && !g.resolved).length;
  const highGaps = gaps.filter((g) => g.severity === "high" && !g.resolved).length;
  const missingReqs = requirements.filter((r) => r.status === "missing_info").length;
  const missingChecklist = checklist.filter((c) => c.status === "missing_information").length;
  const topRisks = [...risks].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);
  const urgency = deadlineUrgency(tender.submission_deadline);

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
          {[
            tender.tender_reference,
            tender.client,
            tender.location,
            tender.project_type && PROJECT_TYPE_LABELS[tender.project_type],
          ].filter(Boolean).join(" · ") || "No project details recorded yet"}
        </span>
      }
      action={<StatusBadge value={tender.status} />}
    >
      <div className="mb-4">
        <KpiPanel title="Project health">
          <KpiTile
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6" /></svg>}
            value={<>{docsProcessed}<span className="text-gray-500 text-[15px]">/{documents.length}</span></>}
            label="Documents processed"
            hint={documents.length === 0 ? "Nothing uploaded yet" : `${documents.length - docsProcessed} still to process`}
          />
          <KpiTile
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12.5l2.5 2.5L16 9" /></svg>}
            value={<>{reqReady}<span className="text-gray-500 text-[15px]">/{requirements.length}</span></>}
            label="Requirements ready"
            color="#15803d"
            hint={requirements.length === 0 ? "Not extracted yet" : `${Math.round((reqReady / requirements.length) * 100)}% complete`}
          />
          <KpiTile
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4" /></svg>}
            value={criticalGaps}
            label="Critical gaps"
            color="#b91c1c"
            hint={`${highGaps} high-severity`}
          />
          <KpiTile
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>}
            // Days remaining is the number that changes a decision; the date
            // itself is the supporting detail, not the headline.
            value={urgency ? (urgency.days < 0 ? "Past" : urgency.days) : "—"}
            label={urgency && urgency.days >= 0 ? "Days to deadline" : "Submission deadline"}
            color={urgency?.color ?? "#4b5563"}
            hint={tender.submission_deadline ? formatDate(tender.submission_deadline) : "No deadline set"}
          />
        </KpiPanel>
      </div>

      <div className="mb-4">
        <Card title="Attention required">
          {documents.length === 0 ? (
            <p className="text-[13px] text-gray-600">
              Upload the tender package to get started —{" "}
              <Link to="/tender/$tenderId/documents" params={{ tenderId }} className={linkCls}>go to Documents →</Link>
            </p>
          ) : attention.length === 0 ? (
            <p className="text-[13px] text-gray-600">Nothing needs attention right now.</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100 -my-1">
              {attention.map((b) => (
                <Link key={b.key} to={b.to} params={{ tenderId }}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-gray-50 transition-colors -mx-2 px-2 rounded-md">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: statusColor(b.severity) }} />
                    <span className="text-[13px] text-gray-800 truncate">{b.label}</span>
                  </span>
                  <span className="text-[13px] font-semibold text-gray-900 shrink-0 tabular-nums">{b.count}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Top risks" action={<Link to="/tender/$tenderId/risks" params={{ tenderId }} className={linkCls}>View all →</Link>}>
          {topRisks.length === 0 ? (
            <p className="text-[13px] text-gray-600">No risks identified yet — the register fills in once documents are processed.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {topRisks.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3">
                  <p className="text-[13px] text-gray-700 flex-1 leading-snug">{r.description}</p>
                  <span className="shrink-0">
                    <StatusBadge value={riskBand(r.risk_score).toLowerCase()} label={`${riskBand(r.risk_score)} (${r.risk_score})`} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Requirements by status" action={<Link to="/tender/$tenderId/requirements" params={{ tenderId }} className={linkCls}>View all →</Link>}>
          {requirements.length === 0 ? (
            <p className="text-[13px] text-gray-600">No requirements extracted yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {(["open", "in_progress", "missing_info", "ready", "approved"] as const).map((s) => {
                const count = requirements.filter((r) => r.status === s).length;
                if (count === 0) return null;
                const pct = Math.round((count / requirements.length) * 100);
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <StatusBadge value={s} label={humanize(s)} />
                      <span className="text-[12px] text-gray-600 tabular-nums shrink-0">{count} · {pct}%</span>
                    </div>
                    {/* A bare count gives no sense of proportion; the bar shows
                        at a glance how much of the package each state holds. */}
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: statusColor(s) }} />
                    </div>
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
