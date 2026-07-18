#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Convert a copy-pasted "Bidding Quizbook"-style text chapter into a bidmonkey
authoring YAML file, so it feeds the SAME problems/<source>/ folder pipeline
(db/normalize_quiz.py) as the hand-authored chapters — reusing that tool's hand
and auction validation instead of duplicating it here.

    uv run db/book_to_yaml.py problems/bid-qb/1-open.txt
        -> writes problems/bid-qb/1-open.yaml
    uv run db/normalize_quiz.py problems/bid-qb --review   # then validate + import

The source (title + slug) comes from the folder, exactly like the rest of the
pipeline: the folder name is the source slug and its index.yaml holds the title.
This converter only emits the quiz + problems for ONE file; the quiz slug is
derived from the filename by normalize_quiz.

Input format (one file = one quiz):

    @quiz: <quiz title>            # no slug — that comes from the filename

    1. s 1d - 1h - ?              # the auction (see below)
    ♠ A J 6 ♥ 8 ♦ A J 8 7 3 ♣ K 10 7 6
    # You open 1♦ and partner responds 1♥. What will you rebid?   (optional; ignored)
    (a) 1NT  (b) 2♣  (c) 2♦
    …explanation… Answer: (b) 2♣.

Any line starting with `#` is a comment and is skipped for the structural lines
— handy for leaving the book's plain-text auction/question in place after paste
(as a transcription cross-check) instead of deleting it.

**Free-form (text) questions.** Some problems ask something whose answer is not a
bid, e.g. "at what vulnerability would you preempt 4♠?". Write the choices as
phrases and the converter detects them (a choice that isn't a bid/pass/double):

    6. s ?
    ♠ K Q 8 7 3 2 ♥ A 6 ♦ K Q 5 ♣ Q 8
    # At what vulnerability would you open a preemptive 4♠?   ← becomes the prompt
    (a) Any    (b) Not vulnerable    (c) Favorable
    …explanation… Answer: (b) Not vulnerable.

A question's choices must be ALL bids or ALL phrases (mixing is an error). A
phrase question emits `prompt` + `text_choices` and MUST keep the book's question
as a `#` line (there's no implicit "your call" to fall back on).

**Auction line** (after `N.`): `<dealer> <call> <call> …`.
  - The first token is the DEALER's seat (`n`/`e`/`s`/`w`).
  - The rest are the calls in order, clockwise from the dealer (N→E→S→W→…).
    `-` and `p` both mean pass; anything else is a call (`1c`, `x`, `2h`, `1nt`,
    unicode strains all work).
  - `?` marks the hero's turn, must be the last token, and must land on South.
So `e 1c x p 1s p ?` is E(deal) 1♣, S dbl, W pass, N 1♠, E pass, S asked; and an
opening bid is just `s ?` (South deals, asked at once).

Only single-question problems are emitted (edit the YAML by hand for multi-
question auctions). The "Answer: (x) …" tail is stripped from the explanation
(the app shows the answer directly). Hand/auction legality (13 cards, ranks
high-to-low, ascending bids, …) is NOT re-checked here — normalize_quiz does that
when the emitted YAML is imported, so those errors come from one place. What this
converter DOES check are copy-paste slips it alone can see: sequential problem
numbering, a bad dealer seat, and the `?` not landing on South.
"""
import json
import os
import re
import sys

SUIT_SYM = {"♠": "s", "♥": "h", "♦": "d", "♣": "c"}
SUIT_ORDER = ["s", "h", "d", "c"]
DASHES = {"—", "–", "-", "−"}                 # void markers (hands)
STRAIN_SYM = {"♣": "c", "♦": "d", "♥": "h", "♠": "s"}
CLOCKWISE = ["n", "e", "s", "w"]               # auction rotates N -> E -> S -> W

OPTION_RE = re.compile(r"\(\s*([a-z])\s*\)\s*([^()]+)")   # tolerant of "(   d)"
NUM_RE = re.compile(r"^(\d+)\.\s*(.*)$")
ANSWER_RE = re.compile(r"Answer:\s*\(\s*([a-z])\s*\)")
CALL_RE = re.compile(r"^(?:[1-7](?:nt|n|[cdhs])|p|x|xx)$")   # a call, post to_call


def looks_like_call(token):
    """Does this choice normalize to a bid/pass/double? (else it's a phrase — a
    free-form `text_choices` option like `Any` or `Not vulnerable`.)"""
    return bool(CALL_RE.match(to_call(token)))


class ProblemError(Exception):
    """A per-problem conversion failure (collected, reported together)."""


def to_call(token):
    """'1♥' -> '1h', 'Pass' -> 'p', '1NT' -> '1nt', 'Double'/'dbl' -> 'x'."""
    t = token.strip()
    low = t.lower()
    if low in ("pass", "p"):
        return "p"
    if low in ("double", "dbl", "x"):
        return "x"
    if low in ("redouble", "redbl", "xx"):
        return "xx"
    for sym, letter in STRAIN_SYM.items():
        t = t.replace(sym, letter)
    return t.lower().replace(" ", "")


def parse_bidding(bidding, num):
    """'n 1c p ?' -> (dealer, [(seat, call), …]) — the calls BEFORE the hero's
    question. The first token is the DEALER's seat; the rest are the calls in
    order, clockwise from the dealer (N->E->S->W). '-' and 'p' both mean pass;
    '?' (last token) is the hero and must land on South. So an opening bid is
    just 's ?'."""
    tokens = bidding.split()
    if not tokens:
        raise ProblemError(f"#{num}: empty auction")
    dealer = tokens[0].lower()
    if dealer not in CLOCKWISE:
        raise ProblemError(f"#{num}: first token must be the dealer seat (n/e/s/w), got {tokens[0]!r}")
    calls = tokens[1:]
    if not calls:
        raise ProblemError(f"#{num}: auction has a dealer but no calls / '?'")
    start = CLOCKWISE.index(dealer)
    prior, hero = [], None
    for i, tok in enumerate(calls):
        seat = CLOCKWISE[(start + i) % 4]
        if tok == "?":
            if i != len(calls) - 1:
                raise ProblemError(f"#{num}: '?' must be the last token (one question per problem)")
            hero = seat
            break
        prior.append((seat, "p" if tok in ("-", "p") else to_call(tok)))
    if hero is None:
        raise ProblemError(f"#{num}: auction has no '?' (the hero's turn)")
    if hero != "s":
        raise ProblemError(f"#{num}: the '?' must land on South, but it falls on "
                           f"{hero.upper()} — check the calls after the dealer")
    return dealer, prior


def parse_hand(text):
    """'♠ A 2 ♥ J 9 8 ♦ A Q ♣ —' -> 'sa2 hj98 daq c-' (suit-then-ranks).

    Symbols -> suit letters, ranks concatenated (10 kept as-is), a void marked
    with '-'. No card-count / high-to-low checks: normalize_quiz validates the
    emitted hand string, so a typo surfaces there with its usual message."""
    holdings, cur = {}, None
    for tok in text.split():
        if tok in SUIT_SYM:
            cur = SUIT_SYM[tok]
            holdings.setdefault(cur, "")
        elif tok in DASHES:
            continue                          # void — the suit stays empty
        else:
            if cur is None:
                raise ProblemError(f"rank {tok!r} before any suit symbol in {text!r}")
            holdings[cur] += tok
    parts = []
    for s in SUIT_ORDER:
        ranks = holdings.get(s, "")
        parts.append(f"{s}{ranks.lower() if ranks else '-'}")
    return " ".join(parts)


def parse_problem(lines, num, comments):
    """One 4+-line block -> a problem dict. Extra trailing lines are treated as a
    wrapped explanation (joined with spaces). `comments` are the block's `#`
    lines (the book's plain-text question), used as the `prompt` when the choices
    are phrases rather than bids (a free-form `text_choices` question)."""
    if len(lines) < 4:
        raise ProblemError(f"#{num}: expected 4 lines (auction, hand, choices, "
                           f"explanation), got {len(lines)}")
    bidding = NUM_RE.match(lines[0]).group(2).strip()
    dealer, prior = parse_bidding(bidding, num)

    hand = parse_hand(lines[1])

    opts = OPTION_RE.findall(lines[2])
    if not (2 <= len(opts) <= 6):        # the app keys options a-f (OPT_LETTERS)
        raise ProblemError(f"#{num}: expected 2-6 choices, got {len(opts)}")
    letters = [ltr for ltr, _ in opts]
    if letters != list("abcdef"[:len(opts)]):
        raise ProblemError(f"#{num}: choices not labelled a,b,c…: {letters}")

    # Bid choices vs. free-form phrases: all-or-nothing (a question is one kind).
    raw = {ltr: val.strip() for ltr, val in opts}
    call_like = [looks_like_call(v) for v in raw.values()]
    is_text = not any(call_like)
    if any(call_like) and not all(call_like):
        raise ProblemError(f"#{num}: choices mix bids and phrases {list(raw.values())} — "
                           f"a question's choices must be all bids or all phrases")

    expl = " ".join(lines[3:])
    idx = expl.rfind("Answer:")
    if idx < 0:
        raise ProblemError(f"#{num}: explanation has no 'Answer: (x) …' tail")
    explanation = expl[:idx].strip()
    am = ANSWER_RE.search(expl[idx:])
    if not am:
        raise ProblemError(f"#{num}: malformed answer tail: {expl[idx:]!r}")
    ans_letter = am.group(1)
    if ans_letter not in raw:
        raise ProblemError(f"#{num}: answer ({ans_letter}) is not among the choices {letters}")

    if is_text:
        # A free-form question needs a prompt — the book's `#` question line(s).
        prompt = " ".join(c for c in comments if c).strip()
        if not prompt:
            raise ProblemError(f"#{num}: a free-form (phrase) question needs a prompt — "
                               f"leave the book's question as a `#` line in the block")
        return {"kind": "text", "hand": hand, "dealer": dealer, "prior": prior,
                "prompt": prompt, "choices": [raw[ltr] for ltr in letters],
                "answer": raw[ans_letter], "explanation": explanation}

    by_letter = {ltr: to_call(val) for ltr, val in opts}
    return {"kind": "bid", "hand": hand, "dealer": dealer, "prior": prior,
            "choices": [by_letter[ltr] for ltr in letters],
            "answer": by_letter[ans_letter], "explanation": explanation}


def emit_yaml(quiz_title, problems):
    """Render the authoring YAML. Each problem gets a `#N` ordinal comment; the
    prior calls become plain auction steps and the hero's `?` step (always South)
    carries the choices/explain/answer. A bid question uses `choices`; a free-form
    question uses `prompt` + `text_choices` (phrases, JSON-quoted so any text is
    safe)."""
    out = [f"quiz: {quiz_title}", "problems:", ""]
    for i, p in enumerate(problems, start=1):
        out.append(f"#{i}")
        out.append(f"- hand: {p['hand']}")
        out.append(f"  dealer: {p['dealer']}")
        out.append("  auction:")
        for seat, call in p["prior"]:
            out.append(f"    - {seat}: {call}")
        out.append('    - s: "?"')
        if p.get("kind") == "text":
            out.append(f"      prompt: {json.dumps(p['prompt'], ensure_ascii=False)}")
            out.append(f"      text_choices: {json.dumps(p['choices'], ensure_ascii=False)}")
            out.append("      explain: |")
            out.append(f"        {p['explanation']}")
            out.append(f"      answer: {json.dumps(p['answer'], ensure_ascii=False)}")
        else:
            out.append(f"      choices: [{', '.join(p['choices'])}]")
            out.append("      explain: |")
            out.append(f"        {p['explanation']}")
            out.append(f"      answer: {p['answer']}")
        out.append("")
    return "\n".join(out) + "\n"


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: book_to_yaml.py <chapter.txt>   # writes <chapter>.yaml")
    src = sys.argv[1]
    text = open(src, encoding="utf-8").read()

    blocks = re.split(r"\n\s*\n", text.strip())
    if not blocks or not blocks[0].lstrip().startswith("@quiz:"):
        sys.exit("error: file must start with a '@quiz: <title>' line")
    quiz_title = blocks[0].split(":", 1)[1].strip()
    if not quiz_title:
        sys.exit("error: '@quiz:' line has no title")

    problems, errors = [], []
    expected = 0
    for block in blocks[1:]:
        # `#` lines are comments — the book's plain-text auction / question, left
        # in after paste as a transcription cross-check. They're skipped for the
        # structural lines, but kept as `comments` (the prompt for a free-form
        # phrase question, which has no implicit "your call").
        raw = block.splitlines()
        lines = [ln for ln in raw if ln.strip() and not ln.lstrip().startswith("#")]
        comments = [ln.lstrip()[1:].strip() for ln in raw if ln.lstrip().startswith("#")]
        if not lines:
            continue
        m = NUM_RE.match(lines[0])
        if not m:
            errors.append(f"block starting {lines[0]!r}: first line is not 'N. …'")
            continue
        expected += 1
        num = int(m.group(1))
        if num != expected:
            errors.append(f"#{expected}: numbered {num} in the file — problem numbers "
                          f"must be sequential (1, 2, 3, …)")
        try:
            problems.append(parse_problem(lines, expected, comments))
        except ProblemError as e:
            errors.append(str(e))

    if errors:
        print("convert failed — fix the source and re-run:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    dst = os.path.splitext(src)[0] + ".yaml"
    with open(dst, "w", encoding="utf-8") as f:
        f.write(emit_yaml(quiz_title, problems))
    print(f"wrote {dst} ({len(problems)} problem(s))", file=sys.stderr)


if __name__ == "__main__":
    main()
