-- bidmonkey — bridge bidding/play quiz
-- Phase 1 schema. Design principle: one row per problem, JSONB for the
-- deal/auction/play (they are authored, not edited in-app), light relational
-- structure for the fields you actually filter and sort on.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE seat          AS ENUM ('N', 'E', 'S', 'W');
CREATE TYPE vulnerability AS ENUM ('none', 'ns', 'ew', 'both');

-- ---------------------------------------------------------------------------
-- problems: one self-contained quiz problem per row
-- ---------------------------------------------------------------------------

CREATE TABLE problems (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- cataloguing / filtering
    title          text,
    source         text,                       -- book, teacher, url, ...
    difficulty     smallint,                   -- optional 1..5, NULL = unrated
    tags           text[]  NOT NULL DEFAULT '{}',
    schema_version smallint NOT NULL DEFAULT 1, -- version of the JSON shapes below

    -- table state
    hero           seat          NOT NULL DEFAULT 'S',   -- the seat the user plays
    dealer         seat          NOT NULL,
    vulnerability  vulnerability NOT NULL DEFAULT 'none',

    -- the content (see JSON shapes below)
    deal           jsonb NOT NULL,                       -- the four hands (each optional)
    auction        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- ordered calls & questions
    play           jsonb,                                -- NULL for bidding-only problems

    -- convenience / narrative
    contract       text,                                 -- e.g. '4H' by 'S'; optional
    commentary     text,                                 -- overall wrap-up explanation

    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT deal_is_object    CHECK (jsonb_typeof(deal)    = 'object'),
    CONSTRAINT auction_is_array  CHECK (jsonb_typeof(auction) = 'array'),
    CONSTRAINT play_is_array     CHECK (play IS NULL OR jsonb_typeof(play) = 'array')
);

CREATE INDEX problems_tags_idx    ON problems USING gin (tags);
CREATE INDEX problems_auction_idx ON problems USING gin (auction jsonb_path_ops);
CREATE INDEX problems_difficulty_idx ON problems (difficulty);

-- keep updated_at honest
CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER problems_touch
    BEFORE UPDATE ON problems
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
