-- TenderAI rebuild, migration 03 — addenda and supersession (Phase 4)
--
-- Run against the TenderAI Supabase project, after migrations 01 and 02.
--
-- Today `revision` is free text on a document row and requirements are
-- append-only, so re-running extraction after Addendum 3 duplicates
-- everything. Meanwhile `addendum` is already a document category: the
-- domain knows addenda exist, the schema does not. Employers issue three,
-- five, eight of them, each rewriting clauses you have already priced.

alter table tender_requirements
  -- Which clause this requirement came from. Null for rows extracted before
  -- the clause parser existed; those keep working, they just cannot take
  -- part in reconciliation.
  add column if not exists clause_id      uuid references tender_clauses(id) on delete set null,
  -- The clause's content_hash at extraction time. If the clause still hashes
  -- to this, the requirement is still current and the clause is not re-read.
  add column if not exists source_hash    text,
  add column if not exists revision       int not null default 1,
  -- Superseded rows are kept, never deleted: "which of my requirements did
  -- Addendum 3 change?" is unanswerable if the old row is gone.
  add column if not exists superseded_by  uuid references tender_requirements(id) on delete set null,
  add column if not exists superseded_at  timestamptz,
  -- Set when the clause disappeared entirely in a later revision.
  add column if not exists withdrawn_at   timestamptz,
  -- The document revision that introduced this row, for "what changed".
  add column if not exists introduced_by_document_id uuid references tender_documents(id) on delete set null;

create index if not exists tender_requirements_clause_idx
  on tender_requirements (clause_id);

-- The working set: current requirements are those neither superseded nor
-- withdrawn. Partial index keeps this fast as history accumulates.
create index if not exists tender_requirements_current_idx
  on tender_requirements (tender_id)
  where superseded_at is null and withdrawn_at is null;

-- Convenience view for the UI's default "current only" list.
create or replace view tender_requirements_current as
  select * from tender_requirements
   where superseded_at is null and withdrawn_at is null;

-- Clause revision history. A re-parse writes a new row here when a clause's
-- hash changes, which is what makes the change traceable to the addendum
-- that caused it rather than just overwriting the old body.
create table if not exists tender_clause_revisions (
  id            uuid primary key default gen_random_uuid(),
  clause_id     uuid not null references tender_clauses(id) on delete cascade,
  document_id   uuid not null references tender_documents(id) on delete cascade,
  tender_id     uuid not null references tenders(id) on delete cascade,
  clause_ref    text not null,
  previous_hash text,
  new_hash      text not null,
  previous_body text,
  new_body      text,
  change_kind   text not null check (change_kind in ('added', 'changed', 'removed')),
  created_at    timestamptz default now()
);

create index if not exists tender_clause_revisions_tender_idx
  on tender_clause_revisions (tender_id, created_at desc);

alter table tender_clause_revisions enable row level security;

drop policy if exists tender_clause_revisions_select on tender_clause_revisions;
create policy tender_clause_revisions_select on tender_clause_revisions
  for select using (
    exists (
      select 1
      from tenders t
      join organization_members m on m.org_id = t.org_id
      where t.id = tender_clause_revisions.tender_id
        and m.user_id = auth.uid()
    )
  );
