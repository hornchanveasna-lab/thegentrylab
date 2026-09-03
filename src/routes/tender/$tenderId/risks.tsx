import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderRisks, riskBand, type TenderRisk } from "@/lib/tender-data";
import { TenderShell, Card, DataTable, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/risks")({
  component: RiskRegister,
});

function RiskRegister() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: risks = [], isLoading } = useTenderRisks(tenderId);

  if (!user) return <div className="min-h-screen bg-white" />;

  return (
    <TenderShell tenderId={tenderId} title="Risk Register">
      <Card>
        {isLoading ? (
          <LoadingSpinner />
        ) : risks.length === 0 ? (
          <EmptyState title="No risks identified yet" hint="Generated automatically from contract conditions and technical specifications once documents are processed." />
        ) : (
          <DataTable<TenderRisk>
            rows={risks}
            keyFn={(r) => r.id}
            columns={[
              { header: "Category", width: "120px", render: (r) => <span className="text-gray-500 whitespace-nowrap">{humanize(r.category)}</span> },
              { header: "Description", render: (r) => <p className="text-gray-800">{r.description}</p> },
              { header: "Clause", width: "90px", render: (r) => <span className="text-gray-400">{r.clause_ref ?? "—"}</span> },
              { header: "P × I", width: "70px", render: (r) => <span className="text-gray-500">{r.probability} × {r.impact}</span> },
              { header: "Score", width: "150px", render: (r) => <StatusBadge value={riskBand(r.risk_score).toLowerCase()} label={`${r.risk_score} · ${riskBand(r.risk_score)}`} /> },
              { header: "Exposure", width: "110px", render: (r) => <span className="text-gray-500">{r.financial_exposure ? `$${r.financial_exposure.toLocaleString()}` : "—"}</span> },
              { header: "Recommendation", render: (r) => <p className="text-gray-400">{r.recommendation ?? "—"}</p> },
            ]}
            footerCount
          />
        )}
      </Card>
    </TenderShell>
  );
}
