import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderRisks, riskBand } from "@/lib/tender-data";
import { TenderShell, Card, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/risks")({
  component: RiskRegister,
});

function RiskRegister() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: risks = [], isLoading } = useTenderRisks(tenderId);

  if (!user) return <div className="min-h-screen bg-[#0a0a0b]" />;

  return (
    <TenderShell tenderId={tenderId} title="Risk Register">
      <Card>
        {isLoading ? (
          <LoadingSpinner />
        ) : risks.length === 0 ? (
          <EmptyState title="No risks identified yet" hint="Generated automatically from contract conditions and technical specifications once documents are processed." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left border-b border-white/8">
                  {["Category", "Description", "Clause", "P × I", "Score", "Exposure", "Recommendation"].map((h) => (
                    <th key={h} className="font-mono text-[9px] uppercase tracking-widest text-white/35 pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {risks.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-4 text-white/60 whitespace-nowrap">{humanize(r.category)}</td>
                    <td className="py-2.5 pr-4 text-white/85 max-w-sm">{r.description}</td>
                    <td className="py-2.5 pr-4 font-mono text-white/40">{r.clause_ref ?? "—"}</td>
                    <td className="py-2.5 pr-4 font-mono text-white/50">{r.probability} × {r.impact}</td>
                    <td className="py-2.5 pr-4"><StatusBadge value={riskBand(r.risk_score).toLowerCase()} label={`${r.risk_score} · ${riskBand(r.risk_score)}`} /></td>
                    <td className="py-2.5 pr-4 font-mono text-white/50">{r.financial_exposure ? `$${r.financial_exposure.toLocaleString()}` : "—"}</td>
                    <td className="py-2.5 text-white/40 max-w-xs">{r.recommendation ?? "—"}</td>
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
