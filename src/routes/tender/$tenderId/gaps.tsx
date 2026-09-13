import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderGaps, resolveGapItem, type TenderGapItem } from "@/lib/tender-data";
import {
  TenderShell, Card, DataTable, StatusBadge, EmptyState, LoadingSpinner, PageLoading, Button,
  humanize, statusColor, type DataTableColumn,
} from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/gaps")({
  component: GapAnalysis,
});

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function GapAnalysis() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: gaps = [], isLoading, refetch } = useTenderGaps(tenderId);

  if (!user) return <PageLoading />;

  // Worst first — an unordered gap list makes you read all of it to find the
  // one that matters.
  const open = gaps.filter((g) => !g.resolved)
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  const resolved = gaps.filter((g) => g.resolved);

  const bySeverity = (["critical", "high", "medium", "low"] as const)
    .map((s) => ({ severity: s, count: open.filter((g) => g.severity === s).length }))
    .filter((s) => s.count > 0);

  const openColumns: DataTableColumn<TenderGapItem>[] = [
    { header: "Description", render: (g) => <p className="text-gray-800 leading-snug">{g.description}</p> },
    { header: "Category", width: "160px", render: (g) => <span className="block truncate text-gray-600">{humanize(g.category)}</span> },
    { header: "Severity", width: "115px", render: (g) => <StatusBadge value={g.severity} /> },
    {
      header: "", width: "95px", align: "right", render: (g) => (
        <Button size="sm" variant="secondary" onClick={() => resolveGapItem(g.id, true).then(() => refetch())}>Resolve</Button>
      ),
    },
  ];

  const resolvedColumns: DataTableColumn<TenderGapItem>[] = [
    { header: "Description", render: (g) => <p className="text-gray-600 leading-snug">{g.description}</p> },
    { header: "Category", width: "160px", render: (g) => <span className="block truncate text-gray-500">{humanize(g.category)}</span> },
    {
      header: "", width: "95px", align: "right", render: (g) => (
        <Button size="sm" variant="ghost" onClick={() => resolveGapItem(g.id, false).then(() => refetch())}>Reopen</Button>
      ),
    },
  ];

  return (
    <TenderShell tenderId={tenderId} title="Gap analysis"
      subtitle={gaps.length > 0 ? `${open.length} open · ${resolved.length} resolved` : undefined}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : gaps.length === 0 ? (
        <EmptyState title="No gaps identified yet" hint="Compares extracted requirements against your Company Knowledge base and generated submission content once documents are processed." />
      ) : (
        <div className="flex flex-col gap-4">
          {bySeverity.length > 0 && (
            <Card>
              <div className="flex flex-wrap gap-x-7 gap-y-3">
                {bySeverity.map(({ severity, count }) => (
                  <div key={severity} className="flex items-center gap-2">
                    <span className="w-1.5 h-7 rounded-sm shrink-0" style={{ backgroundColor: statusColor(severity) }} />
                    <span>
                      <span className="block text-[19px] font-semibold leading-none text-gray-900 tabular-nums">{count}</span>
                      <span className="block text-[11px] text-gray-600 mt-1">{humanize(severity)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title={`Open (${open.length})`}>
            {open.length === 0 ? (
              <p className="text-[13px] text-gray-600 py-2">No open gaps — everything identified has been resolved.</p>
            ) : (
              <DataTable<TenderGapItem> rows={open} keyFn={(g) => g.id} columns={openColumns} footerCount />
            )}
          </Card>

          {resolved.length > 0 && (
            <Card title={`Resolved (${resolved.length})`}>
              <DataTable<TenderGapItem> rows={resolved} keyFn={(g) => g.id} columns={resolvedColumns} />
            </Card>
          )}
        </div>
      )}
    </TenderShell>
  );
}
