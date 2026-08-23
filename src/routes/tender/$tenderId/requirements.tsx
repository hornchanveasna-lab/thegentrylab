import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderRequirements, useRequirementSources, REQUIREMENT_CATEGORIES, type TenderRequirement } from "@/lib/tender-data";
import { TenderShell, Card, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

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
        <div className="flex flex-col gap-2">
          {filtered.map((r) => (
            <RequirementRow key={r.id} req={r} expanded={expanded === r.id} onToggle={() => setExpanded(expanded === r.id ? null : r.id)} />
          ))}
        </div>
      )}
    </TenderShell>
  );
}

function RequirementRow({ req, expanded, onToggle }: { req: TenderRequirement; expanded: boolean; onToggle: () => void }) {
  const { data: sources = [] } = useRequirementSources(expanded ? req.id : undefined);

  return (
    <Card>
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[9px] text-white/30">{req.requirement_code}</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">{humanize(req.category)}</span>
              {req.is_mandatory && <span className="font-mono text-[9px] uppercase tracking-widest text-orange-400">Mandatory</span>}
              {req.ai_confidence && <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">{req.ai_confidence} confidence</span>}
            </div>
            <p className="text-[13px] text-white/85">{req.description}</p>
          </div>
          <StatusBadge value={req.status} />
        </div>
      </button>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/8">
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
      )}
    </Card>
  );
}
