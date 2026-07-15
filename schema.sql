-- bidmonkey — bridge bidding/play quiz. SQLite schema (moved from Postgres).
--
-- Design principle unchanged: one row per problem, JSON text for the
-- deal/auction/play (authored, not edited in-app), light relational structure
-- for what you filter/sort/organise on. Postgres enums/arrays/jsonb become
-- CHECK constraints + JSON text here; `now()` triggers become SQLite triggers.
--
-- Build:  sqlite3 bidmonkey.db < schema.sql
--   then: node db/gen-seed.mjs | sqlite3 bidmonkey.db     (see db/gen-seed.mjs)

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- sources: where a problem came from — a book, a teacher, a website.
-- ---------------------------------------------------------------------------
CREATE TABLE sources (
    slug   TEXT PRIMARY KEY,           -- e.g. 'fakebook'
    title  TEXT NOT NULL               -- e.g. 'FakeBook'
);

-- ---------------------------------------------------------------------------
-- problems: one self-contained quiz problem per row.
-- ---------------------------------------------------------------------------
CREATE TABLE problems (
    id             INTEGER PRIMARY KEY,               -- explicit ids, stable across seeds

    -- cataloguing / filtering
    title          TEXT,
    source         TEXT REFERENCES sources(slug),     -- FK → sources
    difficulty     INTEGER CHECK (difficulty BETWEEN 1 AND 5),  -- NULL = unrated
    tags           TEXT NOT NULL DEFAULT '[]',        -- JSON array of strings
    schema_version INTEGER NOT NULL DEFAULT 1,        -- version of the JSON shapes

    -- table state
    hero           TEXT NOT NULL DEFAULT 'S' CHECK (hero   IN ('N','E','S','W')),
    dealer         TEXT NOT NULL             CHECK (dealer IN ('N','E','S','W')),
    vulnerability  TEXT NOT NULL DEFAULT 'none'
                       CHECK (vulnerability IN ('none','ns','ew','both')),

    -- the content (see schema.v1.json for the JSON shapes)
    deal           TEXT NOT NULL,                     -- JSON object: the four hands
    auction        TEXT NOT NULL DEFAULT '[]',        -- JSON array: calls & questions
    play           TEXT,                              -- JSON array, or NULL (bidding-only)

    -- convenience / narrative
    contract       TEXT,
    commentary     TEXT,

    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),

    CHECK (json_valid(tags)    AND json_type(tags)    = 'array'),
    CHECK (json_valid(deal)    AND json_type(deal)    = 'object'),
    CHECK (json_valid(auction) AND json_type(auction) = 'array'),
    CHECK (play IS NULL OR (json_valid(play) AND json_type(play) = 'array'))
);

CREATE INDEX problems_source_idx     ON problems(source);
CREATE INDEX problems_difficulty_idx ON problems(difficulty);

-- keep updated_at honest
CREATE TRIGGER problems_touch AFTER UPDATE ON problems
FOR EACH ROW BEGIN
    UPDATE problems SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- ---------------------------------------------------------------------------
-- quizzes: an ordered collection of problems, optionally from one source.
-- ---------------------------------------------------------------------------
CREATE TABLE quizzes (
    slug   TEXT PRIMARY KEY,           -- e.g. 'quiz-a'
    title  TEXT NOT NULL,              -- e.g. 'QuizA'
    source TEXT REFERENCES sources(slug)   -- optional: 'this quiz is from this book'
);

-- ---------------------------------------------------------------------------
-- quizzes_problems: which problems are in a quiz, and in what order. A problem
-- may belong to several quizzes; `ordinal` is its 1-based position in this one.
-- ---------------------------------------------------------------------------
CREATE TABLE quizzes_problems (
    quiz_slug  TEXT    NOT NULL REFERENCES quizzes(slug),
    problem_id INTEGER NOT NULL REFERENCES problems(id),
    ordinal    INTEGER NOT NULL,
    PRIMARY KEY (quiz_slug, problem_id),
    UNIQUE (quiz_slug, ordinal)
);

CREATE INDEX quizzes_problems_order_idx ON quizzes_problems(quiz_slug, ordinal);
