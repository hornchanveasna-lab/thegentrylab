import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderRequirements, useRequirementSources, REQUIREMENT_CATEGORIES, type TenderRequirement } from "@/lib/tender-data";
import { TenderShell, Card, DataTable, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/requirements")({
  component: TenderRequirements,
});

function TenderRequirements() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: requirements = [], isLoading } = useTenderRequirements(tenderId);
  const [category, setCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!user) return <div className="min-h-screen bg-[#0a0a0b]" />;

  const filtered = category === "all" ? requirements : requirements.filter((r) => r.category === category);

  return (
    <TenderShell tenderId={tenderId} title="Requirements"
      action={
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white">
          <option value="all" className="bg-[#0a0a0b] text-white">All categories</option>
          {REQUIREMENT_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0a0a0b] text-white">{humanize(c)}</option>)}
        </select>
      }
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState title="No requirements extracted yet"
          hint="Requirements are extracted automatically once uploaded documents finish processing." />
      ) : (
        <Card>
          <DataTable<TenderRequirement>
            rows={filtered}
            keyFn={(r) => r.id}
            onRowClick={(r) => setExpanded(expanded === r.id ? null : r.id)}
            expandedKey={expanded}
            renderExpanded={(r) => <RequirementSources requirementId={r.id} />}
            columns={[
              { header: "Code", width: "90px", render: (r) => <span className="font-mono text-[10px] text-white/40">{r.requirement_code}</span> },
              {
                header: "Requirement", render: (r) => (
                  <div>
                    <p className="text-white/85">{r.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">{humanize(r.category)}</span>
                      {r.is_mandatory && <span className="font-mono text-[9px] uppercase tracking-widest text-orange-400">Mandatory</span>}
                      {r.ai_confidence && <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">{r.ai_confidence} confidence</span>}
                    </div>
                  </div>
                ),
              },
              { header: "Status", width: "120px", render: (r) => <StatusBadge value={r.status} /> },
            ]}
          />
        </Card>
      )}
    </TenderShell>
  );
}

function RequirementSources({ requirementId }: { requirementId: string }) {
  const { data: sources = [] } = useRequirementSources(requirementId);
  return (
    <div className="pt-1">
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">Sources</p>
      {sources.length === 0 ? (
        <p className="text-[11px] text-white/25">No source citation on file.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sources.map((s) => (
            <div key={s.id} className="text-[11px] text-white/50">
              <span className="text-white/70">{s.section_label ?? (s.page_number ? `Page ${s.page_number}` : "Source")}</span>
              {s.quoted_text && <span className="italic"> — "{s.quoted_text}"</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
