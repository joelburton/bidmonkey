#!/usr/bin/env python3
"""
Convert a copy-pasted bridge-problem text file into SQL for the bidmonkey
Supabase schema (sources / quizzes / problems / quizzes_problems).

    python3 db/import_problems.py bid1.txt > insert.sql
    psql "$DB_URL" -f insert.sql        # or paste into the Supabase SQL editor

Idempotent: every insert upserts (on conflict do update), so fixing the source
text and re-running just updates the rows.

Input format
------------
    @source: Title (slug)        # sets the source for following problems
    @quiz:   Title (slug)        # sets the quiz for following problems
    <blank line between problems>

    1. ♠ A 2 ♥ J 9 8 6 2 ♦ A Q J 7 3 ♣ 10      # number + player's hand
    An optional title line                      # else "<QuizTitle> - <n>"
    (a) Pass   (b) 1♦   (c) 1♥                  # 2-4 multiple-choice options
    …explanation… Answer: (c) 1♥.               # prose ending in Answer: (x)

Currently handles opening-bid problems only: hero = South, dealer = South, no
prior auction, one multiple-choice question, only the player's hand given. Other
chapter types can be added later (they'd vary these assumptions).
"""
import json
import re
import sys

# --- assumptions for this problem type (opening bids) -----------------------
HERO = "S"
DEALER = "S"
VULN = "none"
PROMPT = "Your opening bid?"

SUIT_SYM = {"♠": "S", "♥": "H", "♦": "D", "♣": "C"}
DASHES = {"—", "–", "-", "−"}  # void markers
BID_RE = re.compile(r"^(?:[1-7](?:C|D|H|S|NT)|P|X|XX)$")
RANK_RE = re.compile(r"^[AKQJT98765432]+$")
DIRECTIVE_RE = re.compile(r"^@(source|quiz):\s*(.+?)\s*\((.+?)\)\s*$")
NUM_HAND_RE = re.compile(r"^(\d+)\.\s*(.+)$")
OPTION_RE = re.compile(r"\(\s*([a-z])\s*\)\s*([^()]+)")  # tolerant of "(   d)"
ANSWER_RE = re.compile(r"Answer:\s*\(\s*([a-z])\s*\)")


def sql_str(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


def sql_json(v):
    return "NULL" if v is None else sql_str(json.dumps(v, ensure_ascii=False)) + "::jsonb"


def to_bid(token):
    """'1♥' -> '1H', 'Pass' -> 'P', '1NT' -> '1NT', 'Double' -> 'X'."""
    t = token.strip()
    low = t.lower()
    if low in ("pass", "p"):
        return "P"
    if low in ("double", "dbl", "x"):
        return "X"
    if low in ("redouble", "redbl", "xx"):
        return "XX"
    for sym, letter in SUIT_SYM.items():
        t = t.replace(sym, letter)
    return t


def parse_hand(text):
    """'♠ A 2 ♥ J 9 8 ♦ A Q ♣ —' -> {'S':'A2','H':'J98','D':'AQ','C':''}."""
    hand, cur = {}, None
    for tok in text.split():
        if tok in SUIT_SYM:
            cur = SUIT_SYM[tok]
            hand[cur] = ""
        elif tok in DASHES:
            continue  # void — the suit stays empty
        else:
            if cur is None:
                raise ValueError(f"rank {tok!r} before any suit symbol")
            hand[cur] += "T" if tok == "10" else tok
    return hand


class ProblemError(Exception):
    pass


def parse_problem(lines, quiz_title, quiz_slug):
    m = NUM_HAND_RE.match(lines[0])
    if not m:
        raise ProblemError(f"first line is not 'N. <hand>': {lines[0]!r}")
    num, hand_text = int(m.group(1)), m.group(2)

    ans_idx = next((i for i, ln in enumerate(lines) if "Answer:" in ln), None)
    if ans_idx is None:
        raise ProblemError(f"#{num}: no 'Answer: (x)' line")
    opt_idx = next((i for i in range(1, ans_idx) if OPTION_RE.search(lines[i])), None)
    if opt_idx is None:
        raise ProblemError(f"#{num}: no '(a) … (b) …' options line")

    title = lines[1:opt_idx][0].strip() if lines[1:opt_idx] else f"{quiz_title} - {num}"

    opts = [(ltr, to_bid(val)) for ltr, val in OPTION_RE.findall(lines[opt_idx])]
    option_bids = [bid for _, bid in opts]
    by_letter = dict(opts)

    am = ANSWER_RE.search(lines[ans_idx])
    if not am:
        raise ProblemError(f"#{num}: malformed answer line: {lines[ans_idx]!r}")
    answer_letter = am.group(1)
    explanation = " ".join(ln.strip() for ln in lines[opt_idx + 1 : ans_idx + 1])

    hand = parse_hand(hand_text)

    # --- validation: fail loudly rather than ship a broken problem ----------
    total = sum(len(v) for v in hand.values())
    if set(hand) != set("SHDC"):
        raise ProblemError(f"#{num}: hand must list all 4 suits, got {sorted(hand)}")
    if total != 13:
        raise ProblemError(f"#{num}: hand has {total} cards, not 13 ({hand})")
    for suit, holding in hand.items():
        if holding and not RANK_RE.match(holding):
            raise ProblemError(f"#{num}: bad ranks in {suit}: {holding!r}")
    if not (2 <= len(opts) <= 4):
        raise ProblemError(f"#{num}: expected 2-4 options, got {len(opts)}")
    if [ltr for ltr, _ in opts] != list("abcd"[: len(opts)]):
        raise ProblemError(f"#{num}: options not labelled a,b,c…: {[l for l, _ in opts]}")
    for bid in option_bids:
        if not BID_RE.match(bid):
            raise ProblemError(f"#{num}: option {bid!r} is not a legal bid")
    if answer_letter not in by_letter:
        raise ProblemError(f"#{num}: answer ({answer_letter}) is not among the options")

    return {
        "slug": f"{quiz_slug}.{num}",
        "title": title,
        "ordinal": num,
        "deal": {HERO: hand},
        "auction": [
            {
                "question": {
                    "id": "q1",
                    "choiceType": "multiple_choice",
                    "prompt": PROMPT,
                    "options": option_bids,
                    "answer": by_letter[answer_letter],
                    "explanation": explanation,
                }
            }
        ],
        "quiz_slug": quiz_slug,
    }


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: import_problems.py <file.txt>  > insert.sql")
    text = open(sys.argv[1], encoding="utf-8").read()

    sources, quizzes, problems, links, errors = {}, {}, [], [], []
    source_slug = quiz_slug = quiz_title = None

    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [ln for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        if lines[0].lstrip().startswith("@"):
            for ln in lines:
                d = DIRECTIVE_RE.match(ln.strip())
                if not d:
                    errors.append(f"bad directive: {ln!r}")
                    continue
                kind, title, slug = d.group(1), d.group(2), d.group(3)
                if kind == "source":
                    source_slug = slug
                    sources[slug] = title
                else:
                    quiz_slug, quiz_title = slug, title
                    quizzes[slug] = (title, source_slug)
            continue
        # a problem block
        if not quiz_slug:
            errors.append(f"problem before any @quiz: {lines[0]!r}")
            continue
        try:
            p = parse_problem(lines, quiz_title, quiz_slug)
            if any(p["slug"] == q["slug"] for q in problems):
                raise ProblemError(f"duplicate problem slug {p['slug']}")
            problems.append(p)
            links.append((quiz_slug, p["slug"], p["ordinal"]))
        except ProblemError as e:
            errors.append(str(e))

    if errors:
        print("import failed — fix the source and re-run:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    out = ["-- Generated by db/import_problems.py — do not edit by hand.", "begin;"]
    out.append("\n-- sources")
    for slug, title in sources.items():
        out.append(
            f"insert into sources (slug, title) values ({sql_str(slug)}, {sql_str(title)})\n"
            f"  on conflict (slug) do update set title = excluded.title;"
        )
    out.append("\n-- quizzes")
    for slug, (title, src) in quizzes.items():
        out.append(
            f"insert into quizzes (slug, title, source) values ({sql_str(slug)}, {sql_str(title)}, {sql_str(src)})\n"
            f"  on conflict (slug) do update set title = excluded.title, source = excluded.source;"
        )
    out.append("\n-- problems")
    cols = "slug, title, source, difficulty, tags, hero, dealer, vulnerability, deal, auction, play, contract, commentary"
    upd = ", ".join(
        f"{c} = excluded.{c}"
        for c in cols.split(", ")
        if c != "slug"
    )
    for p in problems:
        src = quizzes[p["quiz_slug"]][1]
        out.append(
            f"insert into problems ({cols})\nvalues ("
            f"{sql_str(p['slug'])}, {sql_str(p['title'])}, {sql_str(src)}, NULL, '{{}}'::text[], "
            f"{sql_str(HERO)}, {sql_str(DEALER)}, {sql_str(VULN)}, "
            f"{sql_json(p['deal'])}, {sql_json(p['auction'])}, NULL, NULL, NULL)\n"
            f"  on conflict (slug) do update set {upd}, updated_at = now();"
        )
    out.append("\n-- quizzes_problems (ordinal = the problem's number in the quiz)")
    for quiz, pslug, ordinal in links:
        out.append(
            f"insert into quizzes_problems (quiz_slug, problem_slug, ordinal) "
            f"values ({sql_str(quiz)}, {sql_str(pslug)}, {ordinal})\n"
            f"  on conflict (quiz_slug, problem_slug) do update set ordinal = excluded.ordinal;"
        )
    out.append("commit;")
    print("\n".join(out))

    print(
        f"parsed {len(problems)} problem(s) into "
        f"{len(sources)} source(s) / {len(quizzes)} quiz(zes).",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
