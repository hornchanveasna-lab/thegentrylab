import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderRequirements, useRequirementSources, generateRequirements, REQUIREMENT_CATEGORIES, type TenderRequirement } from "@/lib/tender-data";
import { TenderShell, Card, DataTable, StatusBadge, EmptyState, LoadingSpinner, humanize, sortRows, type DataTableColumn } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/requirements")({
  component: TenderRequirements,
});

function TenderRequirements() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: requirements = [], isLoading } = useTenderRequirements(tenderId);
  const [category, setCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<{ done: number; total: number } | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ columnIndex: number; direction: "asc" | "desc" }>();
  const queryClient = useQueryClient();

  if (!user) return <div className="min-h-screen bg-white" />;

  const filtered = category === "all" ? requirements : requirements.filter((r) => r.category === category);

  async function handleExtract() {
    setExtracting(true); setExtractError(null); setExtractProgress(null);
    try {
      const result = await generateRequirements(tenderId, (done, total) => setExtractProgress({ done, total }));
      if (result.errors.length > 0) setExtractError(`${result.errors.length} document${result.errors.length !== 1 ? "s" : ""} had errors: ${result.errors.join("; ")}`);
      await queryClient.invalidateQueries({ queryKey: ["tender_requirements", tenderId] });
      await queryClient.invalidateQueries({ queryKey: ["tender_checklist", tenderId] });
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Failed to extract requirements");
    } finally {
      setExtracting(false);
      setExtractProgress(null);
    }
  }

  return (
    <TenderShell tenderId={tenderId} title="Requirements"
      action={
        <div className="flex items-center gap-2">
          <button onClick={handleExtract} disabled={extracting}
            className="px-3.5 py-2.5 rounded-xl text-[11px] font-bold disabled:opacity-40"
            style={{ backgroundColor: "#0696D7", color: "#ffffff" }}>
            {extracting
              ? (extractProgress ? `Extracting ${extractProgress.done}/${extractProgress.total}…` : "Starting…")
              : "Extract Requirements"}
          </button>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[11px] text-gray-900">
            <option value="all" className="bg-white text-gray-900">All categories</option>
            {REQUIREMENT_CATEGORIES.map((c) => <option key={c} value={c} className="bg-white text-gray-900">{humanize(c)}</option>)}
          </select>
        </div>
      }
    >
      {extractError && <p className="text-[12px] text-red-600 mb-4">{extractError}</p>}
      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState title="No requirements extracted yet"
          hint="Click Extract Requirements once your documents finish processing — it reads every processed document and pulls out discrete, citable requirements."
          action={<button onClick={handleExtract} disabled={extracting} className="text-[11px] disabled:opacity-40" style={{ color: "#0696D7" }}>{extracting ? "Extracting…" : "Extract Requirements →"}</button>} />
      ) : (
        <Card>
          {(() => {
            const columns: DataTableColumn<TenderRequirement>[] = [
              { header: "Code", width: "90px", sortKey: (r) => r.requirement_code, render: (r) => <span className="text-[10px] text-gray-400">{r.requirement_code}</span> },
              {
                header: "Requirement", render: (r) => (
                  <div>
                    <p className="text-gray-800">{r.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-gray-400">{humanize(r.category)}</span>
                      {r.is_mandatory && <span className="text-[9px] text-orange-400">Mandatory</span>}
                      {r.ai_confidence && <span className="text-[9px] text-gray-400">{r.ai_confidence} confidence</span>}
                    </div>
                  </div>
                ),
              },
              { header: "Status", width: "120px", sortKey: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
            ];
            return (
              <DataTable<TenderRequirement>
                rows={sortRows(filtered, columns, sort)}
                columns={columns}
                keyFn={(r) => r.id}
                onRowClick={(r) => setExpanded(expanded === r.id ? null : r.id)}
                expandedKey={expanded}
                renderExpanded={(r) => <RequirementSources requirementId={r.id} />}
                sort={sort}
                onSortChange={setSort}
                footerCount
              />
            );
          })()}
        </Card>
      )}
    </TenderShell>
  );
}

function RequirementSources({ requirementId }: { requirementId: string }) {
  const { data: sources = [] } = useRequirementSources(requirementId);
  return (
    <div className="pt-1">
      <p className="text-[9px] text-gray-400 mb-2">Sources</p>
      {sources.length === 0 ? (
        <p className="text-[11px] text-gray-400">No source citation on file.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sources.map((s) => (
            <div key={s.id} className="text-[11px] text-gray-500">
              <span className="text-gray-600">{s.section_label ?? (s.page_number ? `Page ${s.page_number}` : "Source")}</span>
              {s.quoted_text && <span className="italic"> — "{s.quoted_text}"</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
