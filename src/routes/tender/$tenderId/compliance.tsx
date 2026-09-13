import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthTender } from "@/lib/auth-tender";
import { useComplianceMatrix, updateComplianceItem, COMPLIANCE_VALUES, type ComplianceMatrixItem, type Compliance } from "@/lib/tender-data";
import {
  TenderShell, Card, DataTable, EmptyState, LoadingSpinner, PageLoading, Button, Toolbar,
  SearchInput, humanize, selectCls, statusColor, type DataTableColumn,
} from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/compliance")({
  component: ComplianceMatrix,
});

function ComplianceMatrix() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: items = [], isLoading, refetch } = useComplianceMatrix(tenderId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Compliance | "all">("all");

  if (!user) return <PageLoading />;

  const q = query.trim().toLowerCase();
  const visible = items.filter((item) => {
    if (filter !== "all" && item.compliance !== filter) return false;
    if (!q) return true;
    return [item.reference, item.contractor_response, item.comment].some((f) => f?.toLowerCase().includes(q));
  });

  const counts = COMPLIANCE_VALUES.map((c) => ({ value: c, count: items.filter((i) => i.compliance === c).length }))
    .filter((c) => c.count > 0);

  const columns: DataTableColumn<ComplianceMatrixItem>[] = [
    { header: "No.", width: "55px", render: (item) => <span className="text-gray-500 tabular-nums">{items.indexOf(item) + 1}</span> },
    { header: "Reference", width: "140px", render: (item) => <span className="block truncate text-gray-700">{item.reference ?? "—"}</span> },
    { header: "Response", render: (item) => <p className="text-gray-700 leading-snug">{item.contractor_response ?? "—"}</p> },
    { header: "Comment", render: (item) => <p className="text-gray-600 leading-snug">{item.comment ?? "—"}</p> },
    {
      header: "Compliance", width: "185px", align: "right", render: (item) => (
        <select
          value={item.compliance}
          aria-label={`Compliance for item ${items.indexOf(item) + 1}`}
          onChange={(e) => user && updateComplianceItem(item.id, user.id, { compliance: e.target.value as Compliance }).then(() => refetch())}
          className={selectCls}
        >
          {COMPLIANCE_VALUES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
        </select>
      ),
    },
  ];

  return (
    <TenderShell tenderId={tenderId} title="Compliance matrix"
      subtitle={items.length > 0 ? `${items.length} line${items.length === 1 ? "" : "s"} against the employer's requirements` : undefined}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState title="No compliance matrix generated yet" hint="Generated automatically once requirements are extracted." />
      ) : (
        <>
          {/* A matrix is read for its distribution first — how much of it
              deviates — and only then line by line. */}
          {counts.length > 0 && (
            <div className="mb-4">
              <Card>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {counts.map(({ value, count }) => (
                    <button key={value} type="button"
                      onClick={() => setFilter(filter === value ? "all" : value)}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 -mx-2 transition-colors ${filter === value ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                      <span className="w-1.5 h-6 rounded-sm shrink-0" style={{ backgroundColor: statusColor(value) }} />
                      <span className="text-left">
                        <span className="block text-[17px] font-semibold leading-none text-gray-900 tabular-nums">{count}</span>
                        <span className="block text-[11px] text-gray-600 mt-1">{humanize(value)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <Toolbar>
            <SearchInput value={query} onChange={setQuery} placeholder="Search reference, response…" />
            <select value={filter} onChange={(e) => setFilter(e.target.value as Compliance | "all")} className={selectCls} aria-label="Filter by compliance">
              <option value="all">All compliance states</option>
              {COMPLIANCE_VALUES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
            </select>
            {(query || filter !== "all") && (
              <Button size="sm" variant="ghost" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>
            )}
          </Toolbar>

          <Card>
            <DataTable<ComplianceMatrixItem>
              rows={visible}
              keyFn={(item) => item.id}
              columns={columns}
              emptyMessage="No lines match these filters."
              footerLabel={`Showing ${visible.length} of ${items.length} line${items.length === 1 ? "" : "s"}`}
            />
          </Card>
        </>
      )}
    </TenderShell>
  );
}
