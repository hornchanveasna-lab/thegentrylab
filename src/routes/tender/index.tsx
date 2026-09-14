import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useCurrentOrg, createTenderOrg, useTenders,
  TENDER_STATUSES, PROJECT_TYPE_LABELS, type Tender, type TenderStatus,
} from "@/lib/tender-data";
import {
  PageShell, Card, StatusBadge, EmptyState, LoadingSpinner, PageLoading, Button, buttonCls,
  DataTable, sortRows, SummaryTile, SearchInput, Toolbar, Banner, DeadlineCell, deadlineUrgency,
  statusColor, humanize, inputCls, labelCls, selectCls, linkCls, ACCENT,
  type DataTableColumn,
} from "@/components/tender/shared";

export const Route = createFileRoute("/tender/")({
  component: TenderDashboard,
});

/** A tender is "live" until it has been submitted or archived — only live
 *  tenders can still miss a deadline, so the closing-soon rail ignores the
 *  other two. */
function isLive(t: Tender): boolean {
  return t.status !== "submitted" && t.status !== "archived";
}

function TenderDashboard() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthTender();

  if (authLoading) return <PageLoading />;

  if (!user) {
    return (
      <div data-theme="light">
        <div className="tenderai-scope min-h-screen bg-white text-gray-900 flex items-center justify-center px-4 font-sans">
          <div className="text-center max-w-sm">
            <span className="w-11 h-11 rounded-lg text-white flex items-center justify-center text-[18px] font-bold mx-auto mb-5" style={{ backgroundColor: ACCENT }}>T</span>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">TenderAI</h1>
            <p className="text-gray-600 text-[13px] leading-relaxed mb-8">
              Upload a tender package. Get structured requirements, compliance, risk, and a draft
              submission — every claim traced back to its source.
            </p>
            <Button variant="primary" onClick={() => signInWithGoogle()}>Sign in with Google</Button>
          </div>
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

  if (loading) return <PageLoading />;

  if (orgs.length === 0) {
    return (
      <div data-theme="light">
        <div className="tenderai-scope min-h-screen bg-white text-gray-900 flex items-center justify-center px-4 font-sans">
          <div className="w-full max-w-sm">
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Get started</p>
            <h1 className="text-xl font-semibold tracking-tight mb-1.5">Create your company</h1>
            <p className="text-gray-600 text-[13px] leading-relaxed mb-6">
              This is the bidding entity your tenders belong to — you can invite teammates to it later.
            </p>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Company name</span>
                <input className={inputCls} placeholder="e.g. Gentry Construction Co., Ltd."
                  value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </label>
              {error && <Banner tone="error">{error}</Banner>}
              <Button
                variant="primary"
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
              >
                {creating ? "Creating…" : "Create company"}
              </Button>
            </div>
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
  const all = useMemo(() => tenders ?? [], [tenders]);

  const [statusFilter, setStatusFilter] = useState<TenderStatus | "all">("all");
  const [query, setQuery] = useState("");
  // Soonest deadline first, so the row that matters most is the row you land
  // on. Previously the list was ordered by `updated_at` with no way to change
  // it, which buries a tender closing this week under one someone edited an
  // hour ago.
  const [sort, setSort] = useState<{ columnIndex: number; direction: "asc" | "desc" }>({ columnIndex: 3, direction: "asc" });

  const counts = useMemo(() => TENDER_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = all.filter((t) => t.status === s).length;
    return acc;
  }, {}), [all]);

  /** Live tenders inside the two-week window (or already past it), soonest
   *  first. This is the one thing the old dashboard had no answer for. */
  const closingSoon = useMemo(() => all
    .filter((t) => {
      if (!isLive(t)) return false;
      const u = deadlineUrgency(t.submission_deadline);
      return !!u && u.level !== "distant";
    })
    .sort((a, b) => new Date(a.submission_deadline!).getTime() - new Date(b.submission_deadline!).getTime()),
    [all]);

  // "All" means all *live* tenders — archived ones are only reachable by
  // selecting the Archived tile, so finished work doesn't pad the list.
  const inScope = useMemo(() => all.filter((t) =>
    statusFilter === "all" ? t.status !== "archived" : t.status === statusFilter
  ), [all, statusFilter]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inScope;
    return inScope.filter((t) =>
      [t.name, t.client, t.consultant, t.location, t.tender_reference, t.project_type && PROJECT_TYPE_LABELS[t.project_type]]
        .some((field) => field?.toLowerCase().includes(q)));
  }, [inScope, query]);

  const columns: DataTableColumn<Tender>[] = [
    {
      header: "Tender",
      sortKey: (t) => t.name.toLowerCase(),
      render: (t) => (
        <Link to="/tender/$tenderId" params={{ tenderId: t.id }} className="block min-w-0 group">
          <span className="block text-[13px] font-medium text-gray-900 group-hover:text-[#046C9B] transition-colors truncate">{t.name}</span>
          {t.tender_reference && <span className="block text-[11px] text-gray-500 truncate">{t.tender_reference}</span>}
        </Link>
      ),
    },
    { header: "Client", width: "160px", sortKey: (t) => (t.client ?? "").toLowerCase(), render: (t) => <span className="block truncate">{t.client ?? "—"}</span> },
    {
      header: "Type", width: "150px", sortKey: (t) => (t.project_type ?? ""),
      render: (t) => <span className="block truncate text-gray-600">{t.project_type ? PROJECT_TYPE_LABELS[t.project_type] : "—"}</span>,
    },
    {
      header: "Deadline", width: "140px",
      // Undated tenders sort last in both directions rather than clustering
      // at the top as epoch-zero.
      sortKey: (t) => t.submission_deadline ? new Date(t.submission_deadline).getTime() : Number.MAX_SAFE_INTEGER,
      render: (t) => <DeadlineCell iso={t.submission_deadline} />,
    },
    { header: "Status", width: "130px", sortKey: (t) => t.status, render: (t) => <StatusBadge value={t.status} /> },
  ];

  const liveTotal = all.filter((t) => t.status !== "archived").length;

  return (
    <PageShell
      title={orgName || "Dashboard"}
      subtitle={isLoading ? "Loading tenders…" : `${liveTotal} active tender${liveTotal === 1 ? "" : "s"}`}
      action={
        <div className="flex items-center gap-2">
          {orgs.length > 1 && (
            <select value={orgId} onChange={(e) => onSwitchOrg(e.target.value)} className={selectCls} aria-label="Switch company">
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <Link to="/tender/new" className={buttonCls("primary")}>+ New Tender</Link>
        </div>
      }
    >
      {closingSoon.length > 0 && (
        <Card title="Closing soon">
          <div className="flex flex-col divide-y divide-gray-100 -my-1">
            {closingSoon.map((t) => {
              const u = deadlineUrgency(t.submission_deadline)!;
              return (
                <Link key={t.id} to="/tender/$tenderId" params={{ tenderId: t.id }}
                  className="flex items-center justify-between gap-3 py-2.5 -mx-2 px-2 rounded-md hover:bg-gray-50 transition-colors">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-8 rounded-sm shrink-0" style={{ backgroundColor: u.color }} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-gray-900 truncate">{t.name}</span>
                      <span className="block text-[11px] text-gray-500 truncate">{t.client ?? "No client recorded"}</span>
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold shrink-0 text-right" style={{ color: u.color }}>{u.phrase}</span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 ${closingSoon.length > 0 ? "mt-4" : ""} mb-6`}>
        <SummaryTile label="All active" count={liveTotal} selected={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        {TENDER_STATUSES
          // Archived earns a tile only once something is actually archived —
          // it was previously a permanent zero taking up a sixth of the row.
          .filter((s) => s !== "archived" || counts[s] > 0)
          .map((s) => (
            <SummaryTile
              key={s}
              label={humanize(s)}
              count={counts[s] ?? 0}
              accent={statusColor(s)}
              selected={statusFilter === s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            />
          ))}
      </div>

      <Toolbar right={<Link to="/tender/list" className={linkCls}>Open full list →</Link>}>
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, client, reference…" />
        {(query || statusFilter !== "all") && (
          <Button size="sm" variant="ghost" onClick={() => { setQuery(""); setStatusFilter("all"); }}>Clear filters</Button>
        )}
      </Toolbar>

      <Card>
        {isLoading ? (
          <LoadingSpinner />
        ) : all.length === 0 ? (
          <EmptyState
            title="No tenders yet"
            hint="Create your first tender, then upload the package — Instructions to Tenderers, conditions, specs, drawings and BOQ — to start extracting requirements."
            action={<Link to="/tender/new" className={buttonCls("primary")}>+ New Tender</Link>}
          />
        ) : (
          <DataTable<Tender>
            rows={sortRows(visible, columns, sort)}
            columns={columns}
            keyFn={(t) => t.id}
            sort={sort}
            onSortChange={setSort}
            emptyMessage="No tenders match these filters."
            footerLabel={`Showing ${visible.length} of ${inScope.length} ${statusFilter === "all" ? "active " : ""}tender${inScope.length === 1 ? "" : "s"}`}
          />
        )}
      </Card>
    </PageShell>
  );
}
