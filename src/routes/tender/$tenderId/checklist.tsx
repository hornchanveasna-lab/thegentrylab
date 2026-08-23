import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderChecklist, updateChecklistItem, CHECKLIST_SECTIONS, type TenderChecklistItem } from "@/lib/tender-data";
import { TenderShell, Card, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/checklist")({
  component: Checklist,
});

function Checklist() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: items = [], isLoading, refetch } = useTenderChecklist(tenderId);

  if (!user) return <div className="min-h-screen bg-[#0a0a0b]" />;

  const bySection = CHECKLIST_SECTIONS.map((section) => ({
    section,
    items: items.filter((i) => i.section === section),
  })).filter((g) => g.items.length > 0);

  return (
    <TenderShell tenderId={tenderId} title="Submission Checklist">
      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState title="No checklist generated yet" hint="Generated automatically from extracted requirements once documents are processed." />
      ) : (
        <div className="flex flex-col gap-4">
          {bySection.map(({ section, items: sectionItems }) => (
            <Card key={section} title={humanize(section)}>
              <div className="flex flex-col divide-y divide-white/6">
                {sectionItems.map((item) => <ChecklistRow key={item.id} item={item} onChanged={refetch} />)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </TenderShell>
  );
}

function ChecklistRow({ item, onChanged }: { item: TenderChecklistItem; onChanged: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-white/85">{item.item_label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {item.is_required && <span className="font-mono text-[9px] uppercase tracking-widest text-orange-400">Required</span>}
          {item.needs_human_input && <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">Needs input</span>}
        </div>
      </div>
      <select
        value={item.status}
        onChange={(e) => updateChecklistItem(item.id, { status: e.target.value as TenderChecklistItem["status"] }).then(onChanged)}
        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white shrink-0"
      >
        {["not_started", "ai_drafted", "in_review", "missing_information", "ready", "approved", "submitted"].map((s) => (
          <option key={s} value={s}>{humanize(s)}</option>
        ))}
      </select>
      <StatusBadge value={item.status} />
    </div>
  );
}
