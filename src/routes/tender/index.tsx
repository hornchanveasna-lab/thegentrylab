import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useCurrentOrg, createTenderOrg, useTenders,
  TENDER_STATUSES, PROJECT_TYPE_LABELS, type Tender,
} from "@/lib/tender-data";
import { PageShell, Card, StatusBadge, EmptyState, LoadingSpinner, inputCls, labelCls } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/")({
  component: TenderDashboard,
});

function TenderDashboard() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthTender();

  if (authLoading) {
    return <div className="min-h-screen bg-[#0a0a0b]" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <div className="text-center max-w-sm">
          <span className="w-10 h-10 rounded-xl bg-[#2563eb] flex items-center justify-center text-[16px] font-black mx-auto mb-4">T</span>
          <h1 className="text-2xl font-extrabold tracking-tight mb-2">TenderAI</h1>
          <p className="text-white/45 text-sm mb-8">Upload a tender package. Get structured requirements, compliance, risk, and a draft submission — every claim traced back to its source.</p>
          <button onClick={() => signInWithGoogle()}
            className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest font-bold"
            style={{ backgroundColor: "color-mix(in srgb, #2563eb 20%, transparent)", color: "#2563eb" }}>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return <OrgGate userId={user.id} />;
}

function OrgGate({ userId }: { userId: string }) {
  const { orgId, org, orgs, loading, setCurrentOrg } = useCurrentOrg(userId);
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (loading) return <div className="min-h-screen bg-[#0a0a0b]" />;

  if (orgs.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <div className="w-full max-w-sm">
          <p className={labelCls + " mb-2"}>Get started</p>
          <h1 className="text-xl font-extrabold tracking-tight mb-1">Create your company</h1>
          <p className="text-white/45 text-[13px] mb-6">This is the bidding entity your tenders belong to — you can invite teammates to it later.</p>
          <div className="flex flex-col gap-3">
            <input className={inputCls} placeholder="Company name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            {error && <p className="text-[12px] text-red-400">{error}</p>}
            <button
              disabled={creating || !orgName.trim()}
              onClick={async () => {
                setCreating(true); setError(null);
                try {
                  await createTenderOrg(userId, orgName.trim());
                  await queryClient.invalidateQueries({ queryKey: ["tender_orgs", userId] });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to create company");
                } finally {
                  setCreating(false);
                }
              }}
              className="py-3 rounded-2xl text-[13px] uppercase tracking-widest font-bold disabled:opacity-40"
              style={{ backgroundColor: "color-mix(in srgb, #2563eb 20%, transparent)", color: "#2563eb" }}
            >
              {creating ? "Creating…" : "Create company"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard orgId={orgId!} orgName={org?.name ?? ""} orgs={orgs} onSwitchOrg={setCurrentOrg} />;
}

function Dashboard({ orgId, orgName, orgs, onSwitchOrg }: {
  orgId: string; orgName: string; orgs: { id: string; name: string }[]; onSwitchOrg: (id: string) => void;
}) {
  const { data: tenders, isLoading } = useTenders(orgId);
  const active = (tenders ?? []).filter((t) => t.status !== "archived");
  const counts = TENDER_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (tenders ?? []).filter((t) => t.status === s).length;
    return acc;
  }, {});

  return (
    <PageShell
      title={orgName || "Dashboard"}
      action={
        <div className="flex items-center gap-2">
          {orgs.length > 1 && (
            <select value={orgId} onChange={(e) => onSwitchOrg(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[12px] text-white">
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <Link to="/tender/new" className="px-4 py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-widest"
            style={{ backgroundColor: "color-mix(in srgb, #2563eb 20%, transparent)", color: "#2563eb" }}>
            + New Tender
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        {TENDER_STATUSES.map((s) => (
          <Card key={s}>
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-1">{s.replace(/_/g, " ")}</p>
            <p className="text-2xl font-extrabold font-mono">{counts[s] ?? 0}</p>
          </Card>
        ))}
      </div>

      <Card title="Active tenders" action={<Link to="/tender/list" className="font-mono text-[10px] uppercase tracking-widest text-[#2563eb]">View all →</Link>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : active.length === 0 ? (
          <EmptyState title="No tenders yet" hint="Create your first tender to start uploading a package."
            action={<Link to="/tender/new" className="font-mono text-[11px] uppercase tracking-widest text-[#2563eb]">+ New Tender</Link>} />
        ) : (
          <div className="flex flex-col divide-y divide-white/8">
            {active.slice(0, 8).map((t) => <TenderRow key={t.id} tender={t} />)}
          </div>
        )}
      </Card>
    </PageShell>
  );
}

function TenderRow({ tender }: { tender: Tender }) {
  return (
    <Link to="/tender/$tenderId" params={{ tenderId: tender.id }} className="flex items-center justify-between py-3.5 gap-3 hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded-lg">
      <div className="min-w-0">
        <p className="text-[13px] font-bold truncate">{tender.name}</p>
        <p className="text-[11px] text-white/40 truncate">
          {tender.client ?? "—"} {tender.project_type && `· ${PROJECT_TYPE_LABELS[tender.project_type]}`}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {tender.submission_deadline && (
          <p className="font-mono text-[10px] text-white/30 hidden sm:block">
            {new Date(tender.submission_deadline).toLocaleDateString()}
          </p>
        )}
        <StatusBadge value={tender.status} />
      </div>
    </Link>
  );
}
