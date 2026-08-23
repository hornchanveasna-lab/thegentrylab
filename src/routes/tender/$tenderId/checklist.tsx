import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderChecklist, updateChecklistItem, CHECKLIST_SECTIONS, type TenderChecklistItem } from "@/lib/tender-data";
import { TenderShell, Card, DataTable, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

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
              <DataTable<TenderChecklistItem>
                rows={sectionItems}
                keyFn={(item) => item.id}
                columns={[
                  {
                    header: "Item", render: (item) => (
                      <div>
                        <p className="text-white/85">{item.item_label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.is_required && <span className="font-mono text-[9px] uppercase tracking-widest text-orange-400">Required</span>}
                          {item.needs_human_input && <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">Needs input</span>}
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: "Set status", width: "170px", render: (item) => (
                      <select
                        value={item.status}
                        onChange={(e) => updateChecklistItem(item.id, { status: e.target.value as TenderChecklistItem["status"] }).then(() => refetch())}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white"
                      >
                        {["not_started", "ai_drafted", "in_review", "missing_information", "ready", "approved", "submitted"].map((s) => (
                          <option key={s} value={s} className="bg-[#0a0a0b] text-white">{humanize(s)}</option>
                        ))}
                      </select>
                    ),
                  },
                  { header: "Status", width: "120px", render: (item) => <StatusBadge value={item.status} /> },
                ]}
              />
            </Card>
          ))}
        </div>
      )}
    </TenderShell>
  );
}
