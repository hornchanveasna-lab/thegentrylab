import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useComplianceMatrix, updateComplianceItem, COMPLIANCE_VALUES, type ComplianceMatrixItem } from "@/lib/tender-data";
import { TenderShell, Card, DataTable, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/compliance")({
  component: ComplianceMatrix,
});

function ComplianceMatrix() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: items = [], isLoading, refetch } = useComplianceMatrix(tenderId);

  if (!user) return <div className="min-h-screen bg-[#0a0a0b]" />;

  return (
    <TenderShell tenderId={tenderId} title="Compliance Matrix">
      <Card>
        {isLoading ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <EmptyState title="No compliance matrix generated yet" hint="Generated automatically once requirements are extracted." />
        ) : (
          <DataTable<ComplianceMatrixItem>
            rows={items}
            keyFn={(item) => item.id}
            columns={[
              { header: "No.", width: "50px", render: (item) => <span className="font-mono text-white/40">{items.indexOf(item) + 1}</span> },
              { header: "Reference", width: "140px", render: (item) => <span className="text-white/60">{item.reference ?? "—"}</span> },
              { header: "Response", render: (item) => <p className="text-white/70 truncate max-w-xs">{item.contractor_response ?? "—"}</p> },
              {
                header: "Compliance", width: "180px", render: (item) => (
                  <select
                    value={item.compliance}
                    onChange={(e) => user && updateComplianceItem(item.id, user.id, { compliance: e.target.value as typeof item.compliance }).then(() => refetch())}
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                  >
                    {COMPLIANCE_VALUES.map((c) => <option key={c} value={c} className="bg-[#0a0a0b] text-white">{humanize(c)}</option>)}
                  </select>
                ),
              },
              { header: "Comment", render: (item) => <p className="text-white/40 truncate max-w-xs">{item.comment ?? "—"}</p> },
            ]}
          />
        )}
      </Card>
    </TenderShell>
  );
}
