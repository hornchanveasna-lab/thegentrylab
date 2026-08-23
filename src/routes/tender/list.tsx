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

  if (!user) return <div className="min-h-screen bg-[#0a0a0b]" />;

  return (
    <PageShell
      title="Tenders"
      action={
        <Link to="/tender/new" className="px-4 py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-widest"
          style={{ backgroundColor: "color-mix(in srgb, #2563eb 20%, transparent)", color: "#2563eb" }}>
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
                <tr className="text-left border-b border-white/8">
                  {["Tender", "Client", "Type", "Deadline", "Status"].map((h) => (
                    <th key={h} className="font-mono text-[9px] uppercase tracking-widest text-white/35 pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {tenders.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 pr-4">
                      <Link to="/tender/$tenderId" params={{ tenderId: t.id }} className="font-bold hover:text-[#2563eb] transition-colors">{t.name}</Link>
                    </td>
                    <td className="py-3 pr-4 text-white/60">{t.client ?? "—"}</td>
                    <td className="py-3 pr-4 text-white/60">{t.project_type ? PROJECT_TYPE_LABELS[t.project_type] : "—"}</td>
                    <td className="py-3 pr-4 font-mono text-white/40">{t.submission_deadline ? new Date(t.submission_deadline).toLocaleDateString() : "—"}</td>
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
