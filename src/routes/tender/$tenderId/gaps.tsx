import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderGaps, resolveGapItem } from "@/lib/tender-data";
import { TenderShell, Card, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/gaps")({
  component: GapAnalysis,
});

function GapAnalysis() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: gaps = [], isLoading, refetch } = useTenderGaps(tenderId);
  const open = gaps.filter((g) => !g.resolved);
  const resolved = gaps.filter((g) => g.resolved);

  if (!user) return <div className="min-h-screen bg-[#0a0a0b]" />;

  return (
    <TenderShell tenderId={tenderId} title="Gap Analysis">
      {isLoading ? (
        <LoadingSpinner />
      ) : gaps.length === 0 ? (
        <EmptyState title="No gaps identified yet" hint="Compares extracted requirements against your Company Knowledge base and generated submission content once documents are processed." />
      ) : (
        <div className="flex flex-col gap-4">
          <Card title={`Open (${open.length})`}>
            <div className="flex flex-col divide-y divide-white/6">
              {open.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-white/85">{g.description}</p>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mt-0.5">{humanize(g.category)}</p>
                  </div>
                  <StatusBadge value={g.severity} />
                  <button onClick={() => resolveGapItem(g.id, true).then(() => refetch())}
                    className="font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-colors shrink-0">
                    Resolve
                  </button>
                </div>
              ))}
              {open.length === 0 && <p className="text-[12px] text-white/30 py-2">No open gaps.</p>}
            </div>
          </Card>
          {resolved.length > 0 && (
            <Card title={`Resolved (${resolved.length})`}>
              <div className="flex flex-col divide-y divide-white/6">
                {resolved.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 py-2.5 opacity-50">
                    <p className="text-[12px] flex-1">{g.description}</p>
                    <button onClick={() => resolveGapItem(g.id, false).then(() => refetch())}
                      className="font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-white transition-colors shrink-0">
                      Reopen
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </TenderShell>
  );
}
