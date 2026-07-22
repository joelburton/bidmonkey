-- Hygiene pass from a schema review: make anon's real privileges match the
-- stated "SELECT only" model, fix linter warnings, and record out-of-band
-- infrastructure so a rebuilt project reproduces it.

-- Supabase's default privileges hand anon TRUNCATE/REFERENCES/TRIGGER on every
-- new table in addition to what init granted — and TRUNCATE is a table-level
-- operation that RLS does NOT govern. Nothing reachable through PostgREST can
-- issue those today, but revoke them so "a leaked anon key can only read"
-- (init.sql) is true by grants alone, on local and remote alike.
revoke truncate, references, trigger
    on sources, problems, quizzes, quizzes_problems
    from anon;

-- touch_updated_at(): pin search_path (the Supabase linter's
-- function_search_path_mutable warning; the body only uses pg_catalog, which is
-- always searched) and drop the default PUBLIC execute grant. Trigger firing
-- doesn't check the caller's EXECUTE privilege, so updates still work.
alter function touch_updated_at() set search_path = '';
revoke execute on function touch_updated_at() from anon, public;

-- The unique (quiz_slug, ordinal) constraint in init.sql already builds this
-- exact (quiz_slug, ordinal) btree; the explicit index was a duplicate.
drop index if exists quizzes_problems_order_idx;

-- Back the documented 1-based ordinal contract (see quizzes_problems in
-- init.sql) with a check — a typo'd 0 would silently sort a problem first.
alter table quizzes_problems
    add constraint quizzes_problems_ordinal_positive check (ordinal >= 1);

-- The public book-covers bucket (sources.cover_url points into it) was created
-- in the dashboard; recreate it here so a rebuilt project has it. Public
-- buckets serve /object/public/ URLs with no storage policy needed. The upsert
-- keeps this a no-op where the bucket already exists. (The cover images
-- themselves live only in remote storage — a fresh local stack has an empty
-- bucket, and local cover_url values point at the remote bucket anyway.)
insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do update set public = true;
