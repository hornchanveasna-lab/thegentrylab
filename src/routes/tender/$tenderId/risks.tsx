import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderRisks, riskBand, type TenderRisk } from "@/lib/tender-data";
import {
  TenderShell, Card, DataTable, StatusBadge, EmptyState, LoadingSpinner, PageLoading,
  humanize, sortRows, statusColor, type DataTableColumn,
} from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/risks")({
  component: RiskRegister,
});

function RiskRegister() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: risks = [], isLoading } = useTenderRisks(tenderId);
  // Highest score first by default — a risk register read in insertion order
  // buries the one that could sink the bid.
  const [sort, setSort] = useState<{ columnIndex: number; direction: "asc" | "desc" }>({ columnIndex: 3, direction: "desc" });

  if (!user) return <PageLoading />;

  const bands = (["Critical", "High", "Medium", "Low"] as const)
    .map((b) => ({ band: b, count: risks.filter((r) => riskBand(r.risk_score) === b).length }))
    .filter((b) => b.count > 0);

  const totalExposure = risks.reduce((sum, r) => sum + (r.financial_exposure ?? 0), 0);

  const columns: DataTableColumn<TenderRisk>[] = [
    { header: "Category", width: "120px", sortKey: (r) => r.category, render: (r) => <span className="block truncate text-gray-600">{humanize(r.category)}</span> },
    { header: "Description", sortKey: (r) => r.description.toLowerCase(), render: (r) => <p className="text-gray-800 leading-snug">{r.description}</p> },
    { header: "Clause", width: "95px", render: (r) => <span className="text-gray-500">{r.clause_ref ?? "—"}</span> },
    {
      header: "Score", width: "150px", sortKey: (r) => r.risk_score,
      render: (r) => <StatusBadge value={riskBand(r.risk_score).toLowerCase()} label={`${r.risk_score} · ${riskBand(r.risk_score)}`} />,
    },
    { header: "P × I", width: "75px", render: (r) => <span className="text-gray-600 tabular-nums">{r.probability} × {r.impact}</span> },
    {
      header: "Exposure", width: "115px", align: "right", sortKey: (r) => r.financial_exposure ?? -1,
      render: (r) => <span className="text-gray-700 tabular-nums">{r.financial_exposure ? `$${r.financial_exposure.toLocaleString()}` : "—"}</span>,
    },
    { header: "Recommendation", render: (r) => <p className="text-gray-600 leading-snug">{r.recommendation ?? "—"}</p> },
  ];

  return (
    <TenderShell tenderId={tenderId} title="Risk register"
      subtitle={risks.length > 0
        ? `${risks.length} risk${risks.length === 1 ? "" : "s"}${totalExposure > 0 ? ` · $${totalExposure.toLocaleString()} total exposure` : ""}`
        : undefined}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : risks.length === 0 ? (
        <EmptyState title="No risks identified yet" hint="Generated automatically from contract conditions and technical specifications once documents are processed." />
      ) : (
        <div className="flex flex-col gap-4">
          {bands.length > 0 && (
            <Card>
              <div className="flex flex-wrap gap-x-7 gap-y-3">
                {bands.map(({ band, count }) => (
                  <div key={band} className="flex items-center gap-2">
                    <span className="w-1.5 h-7 rounded-sm shrink-0" style={{ backgroundColor: statusColor(band.toLowerCase()) }} />
                    <span>
                      <span className="block text-[19px] font-semibold leading-none text-gray-900 tabular-nums">{count}</span>
                      <span className="block text-[11px] text-gray-600 mt-1">{band}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <DataTable<TenderRisk>
              rows={sortRows(risks, columns, sort)}
              keyFn={(r) => r.id}
              columns={columns}
              sort={sort}
              onSortChange={setSort}
              footerCount
            />
          </Card>
        </div>
      )}
    </TenderShell>
  );
}
