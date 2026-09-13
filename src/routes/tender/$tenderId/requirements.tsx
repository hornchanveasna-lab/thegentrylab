import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useTenderRequirements, useRequirementSources, enqueueRequirements, useTenderJobStatus,
  REQUIREMENT_CATEGORIES, type TenderRequirement,
} from "@/lib/tender-data";
import {
  TenderShell, Card, DataTable, StatusBadge, EmptyState, LoadingSpinner, PageLoading, Button,
  Banner, Toolbar, SearchInput, humanize, sortRows, selectCls, type DataTableColumn,
} from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/requirements")({
  component: TenderRequirements,
});

function TenderRequirements() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: requirements = [], isLoading } = useTenderRequirements(tenderId);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ columnIndex: number; direction: "asc" | "desc" }>();
  const queryClient = useQueryClient();
  const { data: jobs } = useTenderJobStatus(tenderId);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["tender_requirements", tenderId] });
    queryClient.invalidateQueries({ queryKey: ["tender_checklist", tenderId] });
  }, [jobs?.succeeded, jobs?.failed, queryClient, tenderId]);

  if (!user) return <PageLoading />;

  const q = query.trim().toLowerCase();
  const filtered = requirements.filter((r) => {
    if (category !== "all" && r.category !== category) return false;
    if (!q) return true;
    return r.description.toLowerCase().includes(q) || r.requirement_code.toLowerCase().includes(q);
  });

  async function handleExtract() {
    setExtracting(true); setExtractError(null);
    try {
      const { queued } = await enqueueRequirements(tenderId);
      if (queued === 0) {
        setExtractError("Nothing to queue — every processed document already has its requirements, or none have been parsed into clauses yet.");
      }
      await queryClient.invalidateQueries({ queryKey: ["tender_jobs", tenderId] });
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Failed to queue extraction");
    } finally {
      setExtracting(false);
    }
  }

  const outstanding = (jobs?.queued ?? 0) + (jobs?.running ?? 0);
  const working = extracting || outstanding > 0;
  const extractLabel = extracting
    ? "Queueing…"
    : outstanding > 0
      ? `Extracting — ${outstanding} left`
      : "Extract requirements";

  const columns: DataTableColumn<TenderRequirement>[] = [
    { header: "Code", width: "100px", sortKey: (r) => r.requirement_code, render: (r) => <span className="text-[12px] text-gray-500 tabular-nums">{r.requirement_code}</span> },
    {
      header: "Requirement", render: (r) => (
        <div className="min-w-0">
          <p className="text-gray-800 leading-snug">{r.description}</p>
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[11px]">
            <span className="text-gray-500">{humanize(r.category)}</span>
            {r.is_mandatory && <span className="font-medium text-orange-700">Mandatory</span>}
            {r.ai_confidence && <span className="text-gray-500">{r.ai_confidence} confidence</span>}
          </div>
        </div>
      ),
    },
    { header: "Status", width: "130px", sortKey: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <TenderShell tenderId={tenderId} title="Requirements"
      subtitle={requirements.length > 0 ? `${requirements.length} extracted from the package` : undefined}
      action={<Button variant="primary" onClick={handleExtract} disabled={working}>{extractLabel}</Button>}
    >
      {extractError && <Banner tone="error">{extractError}</Banner>}

      {isLoading ? (
        <LoadingSpinner />
      ) : requirements.length === 0 ? (
        <EmptyState title="No requirements extracted yet"
          hint="Run extraction once your documents finish processing — it reads every processed document and pulls out discrete, citable requirements."
          action={<Button variant="primary" onClick={handleExtract} disabled={working}>{extractLabel}</Button>} />
      ) : (
        <>
          <Toolbar>
            <SearchInput value={query} onChange={setQuery} placeholder="Search requirements…" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls} aria-label="Filter by category">
              <option value="all">All categories</option>
              {REQUIREMENT_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
            </select>
            {(query || category !== "all") && (
              <Button size="sm" variant="ghost" onClick={() => { setQuery(""); setCategory("all"); }}>Clear filters</Button>
            )}
          </Toolbar>
          <Card>
            <DataTable<TenderRequirement>
              rows={sortRows(filtered, columns, sort)}
              columns={columns}
              keyFn={(r) => r.id}
              onRowClick={(r) => setExpanded(expanded === r.id ? null : r.id)}
              expandedKey={expanded}
              renderExpanded={(r) => <RequirementSources requirementId={r.id} />}
              sort={sort}
              onSortChange={setSort}
              emptyMessage="No requirements match these filters."
              footerLabel={`Showing ${filtered.length} of ${requirements.length} requirement${requirements.length === 1 ? "" : "s"}`}
            />
          </Card>
        </>
      )}
    </TenderShell>
  );
}

function RequirementSources({ requirementId }: { requirementId: string }) {
  const { data: sources = [] } = useRequirementSources(requirementId);
  return (
    <div className="pt-2 pb-1">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Sources</p>
      {sources.length === 0 ? (
        <p className="text-[12px] text-gray-600">No source citation on file.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sources.map((s) => (
            <div key={s.id} className="text-[12px] text-gray-700">
              <span className="font-medium text-gray-900">{s.section_label ?? (s.page_number ? `Page ${s.page_number}` : "Source")}</span>
              {s.quoted_text && <span className="text-gray-600 italic"> — “{s.quoted_text}”</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
