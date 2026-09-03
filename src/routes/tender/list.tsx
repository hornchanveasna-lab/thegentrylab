import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthTender } from "@/lib/auth-tender";
import { useCurrentOrg, useTenders, PROJECT_TYPE_LABELS } from "@/lib/tender-data";
import { PageShell, Card, StatusBadge, EmptyState, LoadingSpinner } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/list")({
  component: TenderList,
});

function TenderList() {
  const { user } = useAuthTender();
  const { orgId } = useCurrentOrg(user?.id);
  const { data: tenders, isLoading } = useTenders(orgId ?? undefined);

  if (!user) return <div className="min-h-screen bg-white" />;

  return (
    <PageShell
      title="Tenders"
      action={
        <Link to="/tender/new" className="px-4 py-2.5 rounded-xl text-[12px] font-bold"
          style={{ backgroundColor: "#0696D7", color: "#ffffff" }}>
          + New Tender
        </Link>
      }
    >
      <Card>
        {isLoading ? (
          <LoadingSpinner />
        ) : !tenders?.length ? (
          <EmptyState title="No tenders yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  {["Tender", "Client", "Type", "Deadline", "Status"].map((h) => (
                    <th key={h} className="text-[9px] text-gray-400 pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenders.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 pr-4">
                      <Link to="/tender/$tenderId" params={{ tenderId: t.id }} className="font-bold hover:text-[#0696D7] transition-colors">{t.name}</Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{t.client ?? "—"}</td>
                    <td className="py-3 pr-4 text-gray-500">{t.project_type ? PROJECT_TYPE_LABELS[t.project_type] : "—"}</td>
                    <td className="py-3 pr-4 text-gray-400">{t.submission_deadline ? new Date(t.submission_deadline).toLocaleDateString() : "—"}</td>
                    <td className="py-3"><StatusBadge value={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
