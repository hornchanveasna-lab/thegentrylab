import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderClarifications, toggleClarificationSelected, type TenderClarification } from "@/lib/tender-data";
import { TenderShell, Card, DataTable, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/clarifications")({
  component: Clarifications,
});

function Clarifications() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: items = [], isLoading, refetch } = useTenderClarifications(tenderId);
  const selectedCount = items.filter((c) => c.selected_for_export).length;

  if (!user) return <div className="min-h-screen bg-[#0a0a0b]" />;

  return (
    <TenderShell tenderId={tenderId} title="Clarifications / RFIs"
      action={selectedCount > 0 ? <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">{selectedCount} selected for export</span> : undefined}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState title="No clarifications drafted yet" hint="Generated automatically from ambiguous or conflicting requirements once documents are processed." />
      ) : (
        <Card>
          <DataTable<TenderClarification>
            rows={items}
            keyFn={(c) => c.id}
            columns={[
              {
                header: "Export", width: "50px", render: (c) => (
                  <input type="checkbox" checked={c.selected_for_export}
                    onChange={(e) => toggleClarificationSelected(c.id, e.target.checked).then(() => refetch())} />
                ),
              },
              {
                header: "Question", render: (c) => (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {c.rfi_number && <span className="font-mono text-[9px] text-white/30">{c.rfi_number}</span>}
                      {c.category && <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">{humanize(c.category)}</span>}
                      {c.reference && <span className="font-mono text-[9px] text-white/25">{c.reference}</span>}
                    </div>
                    <p className="text-white/85 mb-1">{c.question}</p>
                    {c.reason && <p className="text-[11px] text-white/40">Reason: {c.reason}</p>}
                    {c.potential_impact && <p className="text-[11px] text-white/40">Impact: {c.potential_impact}</p>}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}
    </TenderShell>
  );
}
