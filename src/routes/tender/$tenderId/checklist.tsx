import { createFileRoute } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useTenderChecklist, updateChecklistItem, CHECKLIST_SECTIONS, type TenderChecklistItem } from "@/lib/tender-data";
import {
  TenderShell, Card, DataTable, StatusBadge, EmptyState, LoadingSpinner, PageLoading,
  humanize, selectCls, type DataTableColumn,
} from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/checklist")({
  component: Checklist,
});

const CHECKLIST_STATUSES = ["not_started", "ai_drafted", "in_review", "missing_information", "ready", "approved", "submitted"] as const;

/** Which statuses count as "this line is finished" for the per-section
 *  progress readout. */
const DONE_STATUSES = new Set(["ready", "approved", "submitted"]);

function Checklist() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { data: items = [], isLoading, refetch } = useTenderChecklist(tenderId);

  if (!user) return <PageLoading />;

  const bySection = CHECKLIST_SECTIONS.map((section) => ({
    section,
    items: items.filter((i) => i.section === section),
  })).filter((g) => g.items.length > 0);

  const doneTotal = items.filter((i) => DONE_STATUSES.has(i.status)).length;

  const columns: DataTableColumn<TenderChecklistItem>[] = [
    {
      header: "Item", render: (item) => (
        <div className="min-w-0">
          <p className="text-gray-800 leading-snug">{item.item_label}</p>
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[11px]">
            {item.is_required && <span className="font-medium text-orange-700">Required</span>}
            {item.needs_human_input && <span className="text-gray-500">Needs input</span>}
          </div>
        </div>
      ),
    },
    { header: "Status", width: "135px", render: (item) => <StatusBadge value={item.status} /> },
    {
      header: "Set status", width: "165px", align: "right", render: (item) => (
        <select
          value={item.status}
          aria-label={`Status for ${item.item_label}`}
          onChange={(e) => updateChecklistItem(item.id, { status: e.target.value as TenderChecklistItem["status"] }).then(() => refetch())}
          className={selectCls}
        >
          {CHECKLIST_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
      ),
    },
  ];

  return (
    <TenderShell tenderId={tenderId} title="Submission checklist"
      subtitle={items.length > 0 ? `${doneTotal} of ${items.length} items ready` : undefined}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState title="No checklist generated yet" hint="Generated automatically from extracted requirements once documents are processed." />
      ) : (
        <div className="flex flex-col gap-4">
          {bySection.map(({ section, items: sectionItems }) => {
            const done = sectionItems.filter((i) => DONE_STATUSES.has(i.status)).length;
            const pct = Math.round((done / sectionItems.length) * 100);
            return (
              <Card
                key={section}
                title={humanize(section)}
                // Per-section completion, so you can see which part of the
                // submission is lagging without counting rows by eye.
                action={
                  <span className="flex items-center gap-2.5 shrink-0">
                    <span className="h-1.5 w-24 rounded-full bg-gray-100 overflow-hidden">
                      <span className="block h-full rounded-full bg-[#046C9B]" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-[12px] text-gray-600 tabular-nums">{done}/{sectionItems.length}</span>
                  </span>
                }
              >
                <DataTable<TenderChecklistItem>
                  rows={sectionItems}
                  keyFn={(item) => item.id}
                  columns={columns}
                />
              </Card>
            );
          })}
        </div>
      )}
    </TenderShell>
  );
}
