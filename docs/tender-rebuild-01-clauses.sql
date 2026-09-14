-- TenderAI rebuild, migration 01 — clause tree (Phase 1/2)
--
-- Run against the TenderAI Supabase project (not the main one).
-- Additive: nothing reads tender_document_chunks any differently, and the
-- existing extraction path keeps working until Phase 2's code ships.
--
-- Why this table exists: extraction used to assemble every chunk of a
-- document into one string and cut it at 40,000 characters, silently
-- discarding the rest. Clauses are the unit tender documents already use,
-- they are small enough to extract without a cap, and their content_hash is
-- what lets Phase 4 skip re-extracting clauses an addendum did not touch.

create table if not exists tender_clauses (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references tender_documents(id) on delete cascade,
  tender_id     uuid not null references tenders(id) on delete cascade, -- denormalized for RLS, as tender_document_chunks does
  clause_ref    text not null,          -- "4.3.1", "APPENDIX C", "PREAMBLE"
  parent_ref    text,                   -- clause_ref of the parent, null at top level
  title         text,
  body          text not null default '',
  page_from     int,
  page_to       int,
  depth         int not null default 0,
  ordinal       int not null,           -- document order, stable across re-parses
  content_hash  text not null,          -- sha256 of the normalised body; Phase 4 compares on this
  created_at    timestamptz default now(),

  -- One row per clause reference per document. A re-parse upserts on this,
  -- so re-processing a document never duplicates its clauses.
  unique (document_id, clause_ref, ordinal)
);

create index if not exists tender_clauses_document_ordinal_idx
  on tender_clauses (document_id, ordinal);
create index if not exists tender_clauses_tender_idx
  on tender_clauses (tender_id);
create index if not exists tender_clauses_hash_idx
  on tender_clauses (document_id, content_hash);

alter table tender_clauses enable row level security;

-- Mirrors the access rule used by the other tender-scoped tables: you can
-- read a clause if you are a member of the organisation that owns its
-- tender. Writes come from the service role in api/tender/, which bypasses
-- RLS, so there is deliberately no insert/update policy for end users.
drop policy if exists tender_clauses_select on tender_clauses;
create policy tender_clauses_select on tender_clauses
  for select using (
    exists (
      select 1
      from tenders t
      join organization_members m on m.org_id = t.org_id
      where t.id = tender_clauses.tender_id
        and m.user_id = auth.uid()
    )
  );

-- Tracks how far clause parsing has got, separately from
-- requirements_extracted_at, so a document can be re-parsed without
-- re-extracting and vice versa.
alter table tender_documents
  add column if not exists clauses_parsed_at timestamptz;
