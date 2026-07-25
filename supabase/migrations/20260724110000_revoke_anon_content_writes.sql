-- Close a gap found while verifying problem_flags on the remote project: `anon`
-- held insert/update/delete on all four CONTENT tables there, while a local DB
-- built from these migrations alone had SELECT only. Nothing was actually
-- writable — the content tables have no INSERT/UPDATE/DELETE policies, so RLS
-- refused every attempt (a probe PATCH matched zero rows) — but that made "a
-- leaked anon key can only read" (init.sql) true by RLS alone, one layer where
-- the intent was two.
--
-- Cause: on that project postgres's DEFAULT PRIVILEGES in `public` grant anon
-- everything (`anon=arwdDxtm`) on every new table, so each table a migration
-- created started out writable-by-grant. A fresh local stack grants only
-- `Dxtm` — which is why the earlier hygiene migration found just
-- TRUNCATE/REFERENCES/TRIGGER to revoke and stopped there.

-- 1. The content tables as they stand. (No-op where it's already SELECT-only, so
-- this applies cleanly to local and remote alike. `problem_flags` is untouched:
-- it is the one table the app writes to and keeps its explicit grants.)
revoke insert, update, delete, truncate
    on sources, problems, quizzes, quizzes_problems
    from anon;

-- 2. The defaults, so the next `create table` doesn't reopen the same hole. A
-- table that genuinely needs anon writes must say so explicitly — which is
-- already the rule (see problem_flags).
alter default privileges for role postgres in schema public
    revoke insert, update, delete, truncate on tables from anon;
