import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderGaps, resolveGapItem, type TenderGapItem } from "@/lib/tender-data";
import { TenderShell, Card, DataTable, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/gaps")({
  component: GapAnalysis,
});

function GapAnalysis() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: gaps = [], isLoading, refetch } = useTenderGaps(tenderId);
  const open = gaps.filter((g) => !g.resolved);
  const resolved = gaps.filter((g) => g.resolved);

  if (!user) return <div className="min-h-screen bg-white" />;

  return (
    <TenderShell tenderId={tenderId} title="Gap Analysis">
      {isLoading ? (
        <LoadingSpinner />
      ) : gaps.length === 0 ? (
        <EmptyState title="No gaps identified yet" hint="Compares extracted requirements against your Company Knowledge base and generated submission content once documents are processed." />
      ) : (
        <div className="flex flex-col gap-4">
          <Card title={`Open (${open.length})`}>
            {open.length === 0 ? (
              <p className="text-[12px] text-gray-400 py-2">No open gaps.</p>
            ) : (
              <DataTable<TenderGapItem>
                rows={open}
                keyFn={(g) => g.id}
                columns={[
                  { header: "Description", render: (g) => <p className="text-gray-800">{g.description}</p> },
                  { header: "Category", width: "160px", render: (g) => <span className="text-[9px] text-gray-400">{humanize(g.category)}</span> },
                  { header: "Severity", width: "100px", render: (g) => <StatusBadge value={g.severity} /> },
                  {
                    header: "", width: "80px", render: (g) => (
                      <button onClick={() => resolveGapItem(g.id, true).then(() => refetch())}
                        className="text-[10px] text-gray-400 hover:text-gray-900 transition-colors">
                        Resolve
                      </button>
                    ),
                  },
                ]}
              />
            )}
          </Card>
          {resolved.length > 0 && (
            <Card title={`Resolved (${resolved.length})`}>
              <DataTable<TenderGapItem>
                rows={resolved}
                keyFn={(g) => g.id}
                columns={[
                  { header: "Description", render: (g) => <p className="text-gray-500">{g.description}</p> },
                  { header: "Category", width: "160px", render: (g) => <span className="text-[9px] text-gray-400">{humanize(g.category)}</span> },
                  {
                    header: "", width: "80px", render: (g) => (
                      <button onClick={() => resolveGapItem(g.id, false).then(() => refetch())}
                        className="text-[10px] text-gray-400 hover:text-gray-900 transition-colors">
                        Reopen
                      </button>
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </div>
      )}
    </TenderShell>
  );
}
