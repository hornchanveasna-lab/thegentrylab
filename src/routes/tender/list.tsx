import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuthTender } from "@/lib/auth-tender";
import { useCurrentOrg, useTenders, PROJECT_TYPE_LABELS, TENDER_STATUSES, type Tender, type TenderStatus } from "@/lib/tender-data";
import {
  PageShell, Card, StatusBadge, EmptyState, LoadingSpinner, PageLoading, Button, buttonCls,
  DataTable, sortRows, SearchInput, Toolbar, DeadlineCell, formatDate, humanize, selectCls,
  type DataTableColumn,
} from "@/components/tender/shared";

export const Route = createFileRoute("/tender/list")({
  component: TenderList,
});

function TenderList() {
  const { user } = useAuthTender();
  const { orgId } = useCurrentOrg(user?.id);
  const { data: tenders, isLoading } = useTenders(orgId ?? undefined);

  const all = useMemo(() => tenders ?? [], [tenders]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenderStatus | "all">("all");
  // Unlike the dashboard (which leads with the deadline), the full register
  // defaults to most-recently-updated — this is the "what has the team been
  // working on" view, and it keeps archived tenders in scope.
  const [sort, setSort] = useState<{ columnIndex: number; direction: "asc" | "desc" }>({ columnIndex: 5, direction: "desc" });

  if (!user) return <PageLoading />;

  const visible = (() => {
    const q = query.trim().toLowerCase();
    return all.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return [t.name, t.client, t.consultant, t.location, t.tender_reference, t.contract_type, t.project_type && PROJECT_TYPE_LABELS[t.project_type]]
        .some((field) => field?.toLowerCase().includes(q));
    });
  })();

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
    {
      header: "Client", width: "150px", sortKey: (t) => (t.client ?? "").toLowerCase(),
      render: (t) => (
        <span className="block min-w-0">
          <span className="block truncate">{t.client ?? "—"}</span>
          {t.location && <span className="block text-[11px] text-gray-500 truncate">{t.location}</span>}
        </span>
      ),
    },
    {
      header: "Type", width: "140px", sortKey: (t) => (t.project_type ?? ""),
      render: (t) => <span className="block truncate text-gray-600">{t.project_type ? PROJECT_TYPE_LABELS[t.project_type] : "—"}</span>,
    },
    {
      header: "Deadline", width: "140px",
      sortKey: (t) => t.submission_deadline ? new Date(t.submission_deadline).getTime() : Number.MAX_SAFE_INTEGER,
      render: (t) => <DeadlineCell iso={t.submission_deadline} />,
    },
    { header: "Status", width: "125px", sortKey: (t) => t.status, render: (t) => <StatusBadge value={t.status} /> },
    {
      header: "Updated", width: "115px", align: "right", sortKey: (t) => new Date(t.updated_at).getTime(),
      render: (t) => <span className="text-gray-500 tabular-nums">{formatDate(t.updated_at)}</span>,
    },
  ];

  return (
    <PageShell
      title="Tenders"
      subtitle={isLoading ? "Loading…" : `${all.length} tender${all.length === 1 ? "" : "s"} in this company`}
      action={<Link to="/tender/new" className={buttonCls("primary")}>+ New Tender</Link>}
    >
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, client, location…" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TenderStatus | "all")}
          className={selectCls} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {TENDER_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
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
            hint="Create your first tender to start uploading a package."
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
            footerLabel={`Showing ${visible.length} of ${all.length} tender${all.length === 1 ? "" : "s"}`}
          />
        )}
      </Card>
    </PageShell>
  );
}
