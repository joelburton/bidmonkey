-- bidmonkey — initial schema. Applied by `supabase db reset` (local) and
-- `supabase db push` (remote). Content (sources/problems/quizzes) is read by the
-- frontend via PostgREST; one row per problem, jsonb for the authored
-- deal/auction/play, light relational structure for what you filter/sort on.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type seat          as enum ('N', 'E', 'S', 'W');
create type vulnerability as enum ('none', 'ns', 'ew', 'both');

-- ---------------------------------------------------------------------------
-- sources: where a problem came from — a book, a teacher, a website.
-- ---------------------------------------------------------------------------
create table sources (
    slug   text primary key,          -- e.g. 'fakebook'
    title  text not null              -- e.g. 'FakeBook'
);

-- ---------------------------------------------------------------------------
-- problems: one self-contained quiz problem per row.
-- ---------------------------------------------------------------------------
create table problems (
    slug           text primary key,          -- e.g. 'two-decisions'

    title          text,
    source         text references sources(slug),      -- FK → sources
    difficulty     smallint check (difficulty between 1 and 5),  -- NULL = unrated
    tags           text[] not null default '{}',
    schema_version smallint not null default 1,

    hero           seat          not null default 'S',
    dealer         seat          not null,
    vulnerability  vulnerability not null default 'none',

    deal           jsonb not null,                     -- the four hands
    auction        jsonb not null default '[]'::jsonb, -- ordered calls & questions
    play           jsonb,                              -- NULL for bidding-only

    contract       text,
    commentary     text,

    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    constraint deal_is_object   check (jsonb_typeof(deal)    = 'object'),
    constraint auction_is_array check (jsonb_typeof(auction) = 'array'),
    constraint play_is_array    check (play is null or jsonb_typeof(play) = 'array')
);

create index problems_source_idx     on problems(source);
create index problems_difficulty_idx on problems(difficulty);
create index problems_tags_idx       on problems using gin (tags);

-- keep updated_at honest
create function touch_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

create trigger problems_touch
    before update on problems
    for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- quizzes: an ordered collection of problems, optionally from one source.
-- ---------------------------------------------------------------------------
create table quizzes (
    slug   text primary key,          -- e.g. 'quiz-a'
    title  text not null,             -- e.g. 'QuizA'
    source text references sources(slug)   -- optional: 'this quiz is from this book'
);

-- ---------------------------------------------------------------------------
-- quizzes_problems: which problems are in a quiz, and in what order. A problem
-- may belong to several quizzes; `ordinal` is its 1-based position in this one.
-- ---------------------------------------------------------------------------
create table quizzes_problems (
    quiz_slug    text not null references quizzes(slug),
    problem_slug text not null references problems(slug),
    ordinal      int  not null,
    primary key (quiz_slug, problem_slug),
    unique (quiz_slug, ordinal)
);

create index quizzes_problems_order_idx on quizzes_problems(quiz_slug, ordinal);

-- ---------------------------------------------------------------------------
-- Row-Level Security. No auth: the app uses the public `anon` role, which may
-- only SELECT. Content is authored via psql / the SQL editor (which bypasses
-- RLS), so a leaked anon key can only read.
-- ---------------------------------------------------------------------------
alter table sources          enable row level security;
alter table problems         enable row level security;
alter table quizzes          enable row level security;
alter table quizzes_problems enable row level security;

create policy "anon read sources"          on sources          for select to anon using (true);
create policy "anon read problems"         on problems         for select to anon using (true);
create policy "anon read quizzes"          on quizzes          for select to anon using (true);
create policy "anon read quizzes_problems" on quizzes_problems for select to anon using (true);

-- Table grants are required *in addition* to the RLS policies: the policies say
-- which rows anon may see, but without SELECT granted anon can't touch the table
-- at all (Supabase's SQL editor adds these implicitly; a migration must not).
grant usage on schema public to anon;
grant select on sources, problems, quizzes, quizzes_problems to anon;
