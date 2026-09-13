-- CM app — "Companies on this project"
--
-- Run once in the Supabase SQL editor for the CM project. The repo has no
-- migration tooling, so this file is the record of the change rather than
-- something that gets applied automatically.
--
-- Why: cm_companies is a single account-wide master list, so a company is
-- entered once and reused across projects. Without a project link, every
-- company picker offered every company on the account, which let a contract,
-- instruction, contact or manpower row name a company belonging to an
-- unrelated project. This table scopes those pickers without duplicating
-- company records per project (CLAUDE.md §27).
--
-- Shape mirrors cm_project_subcontractors, which links a project to a
-- directory contact the same way.
--
-- Before running: confirm the column types match your existing CM tables.
-- If owner_id is text rather than uuid on cm_project_subcontractors, use
-- text here too, and mirror that table's RLS policy rather than the
-- placeholder below.

create table if not exists cm_project_companies (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references cm_projects(id)  on delete cascade,
  owner_id        uuid not null,
  company_id      uuid not null references cm_companies(id) on delete cascade,
  -- What the company does on THIS project. Deliberately separate from
  -- cm_companies.company_type: the same firm can be Consultant on one
  -- project and Designer on another.
  role_on_project text,
  created_at      timestamptz not null default now(),
  -- A company appears at most once per project; assigning twice is a no-op
  -- rather than a duplicate row.
  unique (project_id, company_id)
);

create index if not exists cm_project_companies_project_idx
  on cm_project_companies (project_id);

alter table cm_project_companies enable row level security;

-- Placeholder policy — replace with the same shape used by
-- cm_project_subcontractors so access rules stay consistent.
create policy cm_project_companies_owner_rw
  on cm_project_companies
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
