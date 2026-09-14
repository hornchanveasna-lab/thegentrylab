import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderClarifications, toggleClarificationSelected, type TenderClarification } from "@/lib/tender-data";
import {
  TenderShell, Card, DataTable, EmptyState, LoadingSpinner, PageLoading, Button, Toolbar,
  SearchInput, Banner, humanize, ACCENT, type DataTableColumn,
} from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/clarifications")({
  component: Clarifications,
});

function Clarifications() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: items = [], isLoading, refetch } = useTenderClarifications(tenderId);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return <PageLoading />;

  const selected = items.filter((c) => c.selected_for_export);
  const q = query.trim().toLowerCase();
  const visible = items.filter((c) => !q ||
    [c.question, c.reason, c.reference, c.rfi_number, c.category].some((f) => f?.toLowerCase().includes(q)));

  /** Select/deselect every currently visible row in one pass — going through
   *  40 RFI checkboxes one at a time before an export was the main friction
   *  on this page. */
  async function setAllVisible(next: boolean) {
    setBusy(true);
    try {
      await Promise.all(visible
        .filter((c) => c.selected_for_export !== next)
        .map((c) => toggleClarificationSelected(c.id, next)));
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  const allVisibleSelected = visible.length > 0 && visible.every((c) => c.selected_for_export);

  const columns: DataTableColumn<TenderClarification>[] = [
    {
      header: "Export", width: "70px", render: (c) => (
        <input type="checkbox" checked={c.selected_for_export}
          aria-label={`Include ${c.rfi_number ?? "this clarification"} in export`}
          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
          style={{ accentColor: ACCENT }}
          onChange={(e) => toggleClarificationSelected(c.id, e.target.checked).then(() => refetch())} />
      ),
    },
    {
      header: "Question", render: (c) => (
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mb-1 text-[11px]">
            {c.rfi_number && <span className="font-medium text-gray-700 tabular-nums">{c.rfi_number}</span>}
            {c.category && <span className="text-gray-500">{humanize(c.category)}</span>}
            {c.reference && <span className="text-gray-500">{c.reference}</span>}
          </div>
          <p className="text-gray-800 leading-snug mb-1">{c.question}</p>
          {c.reason && <p className="text-[12px] text-gray-600 leading-snug"><span className="font-medium text-gray-700">Reason:</span> {c.reason}</p>}
          {c.potential_impact && <p className="text-[12px] text-gray-600 leading-snug"><span className="font-medium text-gray-700">Impact:</span> {c.potential_impact}</p>}
        </div>
      ),
    },
  ];

  return (
    <TenderShell tenderId={tenderId} title="Clarifications / RFIs"
      subtitle={items.length > 0 ? `${items.length} drafted · ${selected.length} selected for export` : undefined}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState title="No clarifications drafted yet" hint="Generated automatically from ambiguous or conflicting requirements once documents are processed." />
      ) : (
        <>
          {selected.length > 0 && (
            <Banner tone="info">
              {selected.length} clarification{selected.length === 1 ? "" : "s"} selected for export.
            </Banner>
          )}

          <Toolbar>
            <SearchInput value={query} onChange={setQuery} placeholder="Search questions…" />
            {query && <Button size="sm" variant="ghost" onClick={() => setQuery("")}>Clear search</Button>}
            <Button size="sm" disabled={busy || visible.length === 0} onClick={() => setAllVisible(!allVisibleSelected)}>
              {allVisibleSelected ? "Deselect all shown" : "Select all shown"}
            </Button>
          </Toolbar>

          <Card>
            <DataTable<TenderClarification>
              rows={visible}
              keyFn={(c) => c.id}
              columns={columns}
              emptyMessage="No clarifications match that search."
              footerLabel={`Showing ${visible.length} of ${items.length} clarification${items.length === 1 ? "" : "s"}`}
            />
          </Card>
        </>
      )}
    </TenderShell>
  );
}
