import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useComplianceMatrix, updateComplianceItem, COMPLIANCE_VALUES } from "@/lib/tender-data";
import { TenderShell, Card, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

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
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left border-b border-white/8">
                  {["No.", "Reference", "Response", "Compliance", "Comment"].map((h) => (
                    <th key={h} className="font-mono text-[9px] uppercase tracking-widest text-white/35 pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {items.map((item, i) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-4 font-mono text-white/40">{i + 1}</td>
                    <td className="py-2.5 pr-4 text-white/60">{item.reference ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-white/70 max-w-xs truncate">{item.contractor_response ?? "—"}</td>
                    <td className="py-2.5 pr-4">
                      <select
                        value={item.compliance}
                        onChange={(e) => user && updateComplianceItem(item.id, user.id, { compliance: e.target.value as typeof item.compliance }).then(() => refetch())}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                      >
                        {COMPLIANCE_VALUES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 text-white/40 max-w-xs truncate">{item.comment ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </TenderShell>
  );
}
