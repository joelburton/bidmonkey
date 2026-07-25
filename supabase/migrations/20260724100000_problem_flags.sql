-- problem_flags: the review list. A problem lands here when it's answered with
-- anything other than the preferred answer (wrong, or an `accept` alternative —
-- "not wrong" but still worth revisiting), or when it's flagged by hand. The
-- source's "Flagged" button then runs randomly through whatever is listed.
--
-- Why a table and not a column on problems: flags are per *player*, problems are
-- content. This keeps the seam for more than one player (and for per-problem
-- notes) without a later redesign.

create type flag_reason as enum ('wrong', 'alternate', 'manual');

create table problem_flags (
    -- No auth of any kind (see CLAUDE.md), so the player is a constant, matching
    -- data/flags.ts PLAYER. It exists so flags follow the *person* rather than
    -- the browser — flag a problem on the phone, review it on the desktop — and
    -- so real users later means filling this from a session, not reshaping the
    -- table.
    player       text not null default 'joel',
    problem_slug text not null references problems(slug) on delete cascade,
    reason       flag_reason not null,
    -- Room for the "I keep getting this one wrong" note. Nothing writes it yet;
    -- an upsert of (player, problem_slug, reason) leaves it alone.
    note         text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    primary key (player, problem_slug)
);

-- The app's only query is "everything this player flagged".
create index problem_flags_player_idx on problem_flags(player);

create trigger problem_flags_touch
    before update on problem_flags
    for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + grants. This is the first table the browser WRITES to: content stays
-- read-only, but anon needs insert/update/delete here (unflagging deletes the
-- row — row presence is the flag). With no auth there is nothing to check a row
-- against, so the policies are open and the anon key is effectively write access
-- to this table. Accepted deliberately: it's one person's review list, the
-- content it points at is already public, and losing it costs nothing.
--
-- Both the policies AND the grants are required — an RLS policy without the
-- matching grant gives 401/"permission denied" (see init.sql).
-- ---------------------------------------------------------------------------
alter table problem_flags enable row level security;

create policy "anon read flags"   on problem_flags for select to anon using (true);
create policy "anon insert flags" on problem_flags for insert to anon with check (true);
create policy "anon update flags" on problem_flags for update to anon using (true) with check (true);
create policy "anon delete flags" on problem_flags for delete to anon using (true);

grant select, insert, update, delete on problem_flags to anon;

-- Supabase's defaults would also hand anon TRUNCATE/REFERENCES/TRIGGER, which
-- RLS does not govern — revoke them, as the hygiene migration does for the
-- content tables.
revoke truncate, references, trigger on problem_flags from anon;
