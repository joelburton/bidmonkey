#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = ["pyyaml", "jsonschema"]
# ///
"""
Normalize a hand-authored quiz YAML file into bidmonkey's canonical shape.

    uv run db/normalize_quiz.py sayc.yaml             # canonical JSON to stdout
    uv run db/normalize_quiz.py sayc.yaml --review    # + expanded auctions to stderr

`uv run` reads the inline dependency block above and builds a cached ephemeral
environment automatically — no venv to create or activate. (Plain
`python3 db/normalize_quiz.py …` also works if pyyaml/jsonschema are installed.)

Input is the shorthand described by db/quiz.schema.json (one source + one quiz +
its problems). This script:
  1. structurally validates against db/quiz.schema.json (if `jsonschema` is
     installed — otherwise it skips that pre-check with a note);
  2. normalizes the shorthand into the canonical deal/auction/play shapes that
     schema.v1.json and the `problems` table use (uppercase seats, `NT` strain,
     suit-then-ranks holdings sorted high-low, cards as SUIT+rank, vuln folded to
     the `none/ns/ew/both` enum, `#` titles, `[slug]` parsing);
  3. runs the domain checks JSON Schema can't (the x-deferred-checks list in
     quiz.schema.json), failing loudly with a per-problem message rather than
     emitting a broken problem: 13-card hands, no duplicate cards within or
     across hands, `?`-seat == player, auction contiguity + legality (ascending
     bids, X/XX context, answers legal in context), the stated contract matching
     the auction's computed final contract, and — as far as the known hands allow
     — play legality (opening lead, clockwise order, follow-suit, card-in-hand,
     no card played twice, trick-winner leads next).
"""
import argparse
import json
import re
import sys

from emit_sql import emit_sql

# --- canonical vocabulary ---------------------------------------------------
CLOCKWISE = ["N", "E", "S", "W"]          # bidding/play rotate clockwise
RANK_ORDER = "AKQJT98765432"              # high to low; ten = T
SUIT_ORDER = ["S", "H", "D", "C"]         # required input order for a hand
SUIT_OF = {"s": "S", "h": "H", "d": "D", "c": "C",
           "♠": "S", "♥": "H", "♦": "D", "♣": "C"}
STRAIN_OF = {"c": "C", "d": "D", "h": "H", "s": "S", "n": "NT", "nt": "NT",
             "♣": "C", "♦": "D", "♥": "H", "♠": "S"}

SCHEMA_PATH = __file__.rsplit("/", 1)[0] + "/quiz.schema.json"


class ProblemError(Exception):
    """A per-problem validation failure (collected, reported together)."""


# --- small parsers ----------------------------------------------------------
def parse_source_or_quiz(value, kind):
    """'Title [slug]' -> ('Title', 'slug')."""
    m = re.match(r"^\s*(.*?)\s*\[([^\]]+)\]\s*$", value)
    if not m:
        raise ProblemError(f"{kind} must look like 'Title [slug]', got {value!r}")
    return m.group(1), m.group(2).strip()


def suit_of(ch):
    return SUIT_OF.get(ch) or SUIT_OF.get(ch.lower())


def parse_hand(text, where):
    """'sa65 hkq2 d53 caqj97' -> {'S':'A65','H':'KQ2','D':'53','C':'AQJ97'}."""
    hand, order = {}, []
    for tok in text.split():
        suit = suit_of(tok[0])
        if suit is None:
            raise ProblemError(f"{where}: {tok!r} does not start with a suit")
        if suit in hand:
            raise ProblemError(f"{where}: suit {suit} appears twice")
        rest, ranks, i = tok[1:], "", 0
        if rest == "-":
            rest = ""
        while i < len(rest):
            if rest[i:i + 2] == "10":
                ranks, i = ranks + "T", i + 2
            else:
                ch = rest[i].upper()
                if ch not in RANK_ORDER:
                    raise ProblemError(f"{where}: bad rank {rest[i]!r} in {tok!r}")
                ranks, i = ranks + ch, i + 1
        seen = set()
        for r in ranks:
            if r in seen:
                raise ProblemError(f"{where}: {suit}{r} appears twice in one hand")
            seen.add(r)
        hand[suit] = "".join(sorted(ranks, key=RANK_ORDER.index))
        order.append(suit)
    if order != SUIT_ORDER:
        raise ProblemError(f"{where}: suits must be S H D C in order, got {' '.join(order)}")
    total = sum(len(v) for v in hand.values())
    if total != 13:
        raise ProblemError(f"{where}: hand has {total} cards, not 13")
    return hand


def parse_call(tok, where):
    raw = tok.strip()
    alert = "*" if raw.endswith("*") else ""   # trailing * = alertable call, kept for display
    t = raw[:-1].strip() if alert else raw
    low = t.lower()
    if low in ("p", "pass"):
        core = "P"
    elif low in ("x", "double", "dbl"):
        core = "X"
    elif low in ("xx", "redouble", "redbl"):
        core = "XX"
    else:
        m = re.match(r"^([1-7])(nt|n|[cdhs♣♦♥♠])$", low)
        if not m:
            raise ProblemError(f"{where}: {tok!r} is not a legal call")
        core = f"{m.group(1)}{STRAIN_OF[m.group(2)]}"
    return core + alert


def parse_card(tok, where):
    m = re.match(r"^(10|[akqjt2-9])([cdhs♣♦♥♠])$", tok.strip().lower())
    if not m:
        raise ProblemError(f"{where}: {tok!r} is not a legal card (rank-then-suit, e.g. 3C)")
    rank = "T" if m.group(1) == "10" else m.group(1).upper()
    return f"{SUIT_OF[m.group(2)]}{rank}"


def normalize_explanation(text):
    """Trim surrounding blank lines and per-line trailing whitespace, keeping the
    line breaks intact — the app renders each line as a paragraph (first-line
    indented after the first) and a run of `-` lines as a bulleted list."""
    lines = [ln.rstrip() for ln in text.splitlines()]
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines)


def normalize_vuln(value, player):
    if value is None:
        return None          # unspecified — the DB stores NULL, distinct from 'none'
    v = str(value).strip().lower()
    ours = "ns" if player in ("N", "S") else "ew"
    theirs = "ew" if ours == "ns" else "ns"
    table = {"none": "none", "-": "none", "love": "none",
             "both": "both", "all": "both",
             "ns": "ns", "ew": "ew", "us": ours, "them": theirs}
    if v not in table:
        raise ProblemError(f"vuln {value!r} is not recognized")
    return table[v]


def normalize_contract(value, where):
    """'3NT W' -> ('3NT W', 3, 'NT', '', 'W')  (text, level, strain, doubled, declarer)."""
    m = re.match(r"^\s*([1-7])(nt|n|[cdhs♣♦♥♠])(xx|x)?\s+([nesw])\s*$", value.strip().lower())
    if not m:
        raise ProblemError(f"{where}: contract {value!r} must look like '3NT W'")
    level, strain = int(m.group(1)), STRAIN_OF[m.group(2)]
    doubled = m.group(3).upper() if m.group(3) else ""
    declarer = m.group(4).upper()
    return f"{level}{strain}{doubled} {declarer}", level, strain, doubled, declarer


# --- bidding rules (mirror src/bidding.ts so the validator agrees with the app)
STRAINS = ["C", "D", "H", "S", "NT"]


def call_core(call):
    """Strip the trailing alert marker (`*`) — it's display-only, ignored by
    ranking, legality, and matching."""
    return call.rstrip("*")


def parse_bid(call):
    """A made bid -> (level, strain); calls that aren't bids (P/X/XX) -> None."""
    m = re.match(r"^([1-7])(NT|C|D|H|S)$", call_core(call))
    return (int(m.group(1)), m.group(2)) if m else None


def bid_rank(level, strain):
    return (level - 1) * 5 + STRAINS.index(strain)


def same_side(a, b):
    return (a in ("N", "S")) == (b in ("N", "S"))


def last_nonpass(seated):
    """The most recent (seat, call) that isn't a pass, or None."""
    for seat, call in reversed(seated):
        if call_core(call) != "P":
            return seat, call
    return None


def compute_final_contract(seated):
    """Final contract of a (seat, call) sequence, or None if passed out.

    Mirrors finalContract() in src/bidding.ts: the last bid's strain/level wins,
    declarer is the first of that side to have named the strain, doubling follows
    the last X/XX not cleared by a later bid.
    """
    last = None
    for seat, call in seated:
        if parse_bid(call):
            last = (*parse_bid(call), seat)          # (level, strain, seat)
    if last is None:
        return None
    level, strain, last_seat = last
    declarer = last_seat
    for seat, call in seated:
        b = parse_bid(call)
        if b and b[1] == strain and same_side(seat, last_seat):
            declarer = seat
            break
    doubled = ""
    for _, call in seated:
        if parse_bid(call):
            doubled = ""
        elif call_core(call) in ("X", "XX"):
            doubled = call_core(call)
    return level, strain, declarer, doubled


# --- step helpers (auction & play share the seat-key convention) ------------
META_KEYS = {"explain", "answer", "accept", "choices"}


def seat_key_of(step, where, allow_all):
    keys = [k for k in step if k.lower() not in META_KEYS]
    if len(keys) != 1:
        raise ProblemError(f"{where}: a step needs exactly one seat key, got {keys}")
    raw = keys[0]
    if allow_all and raw.lower() == "all":
        return "ALL", step[raw]
    if raw.lower() not in ("n", "e", "s", "w"):
        raise ProblemError(f"{where}: {raw!r} is not a seat")
    return raw.upper(), step[raw]


def build_question(step, where, qid, parse, free_type):
    """A `?` step -> canonical question (multiple_choice if `choices`, else free).

    Returns (question, answer); `answer` is also the call/card that continues.
    Shared by the auction (parse_call / enter_bid) and play (parse_card /
    enter_card).
    """
    if "answer" not in step:
        raise ProblemError(f"{where}: a '?' needs an `answer`")
    answer = parse(step["answer"], f"{where} answer")
    accept = [parse(a, f"{where} accept") for a in step.get("accept", [])]

    q = {"id": qid, "answer": answer}
    if "choices" in step:
        options = [parse(c, f"{where} choice") for c in step["choices"]]
        if len(options) < 2:
            raise ProblemError(f"{where}: multiple choice needs at least 2 choices")
        cores = [call_core(o) for o in options]   # match ignoring the alert marker
        if call_core(answer) not in cores:
            raise ProblemError(f"{where}: answer {answer} is not one of the choices {options}")
        bad = [a for a in accept if call_core(a) not in cores]
        if bad:
            raise ProblemError(f"{where}: accept {bad} not among the choices {options}")
        q["choiceType"] = "multiple_choice"
        q["options"] = options
    else:
        q["choiceType"] = free_type
    if accept:
        q["accept"] = accept
    if step.get("explain"):
        q["explanation"] = normalize_explanation(step["explain"])

    order = ("id", "choiceType", "answer", "options", "accept", "explanation")
    return {k: q[k] for k in order if k in q}, answer


# --- auction ----------------------------------------------------------------
def process_auction(steps, dealer, player, close=False):
    """Expand shorthand into a seat-contiguous canonical auction.

    Returns (canonical, echo, final): `canonical` is the schema.v1.json auction
    array (seat implicit: element 0 = dealer, then clockwise); `echo` is a
    readable 'N:P E:1NT S:?(=1NT)' string; `final` is the computed final contract
    (level, strain, declarer, doubled) or None. Validates call legality as it
    goes (ascending bids, X/XX context) — the seat's answer for a `?` is checked
    too, so an answer illegal at that point is caught. Skipped seats are filled
    with passes (a silent side that never bids is normal). When `close` is set
    (the problem states a contract), the auction is completed with the closing
    passes if the author didn't write them.
    """
    seated, canonical, echo = [], [], []   # seated = (seat, call) mirror of canonical
    idx = CLOCKWISE.index(dealer)
    qn = 0

    def emit(seat, canon_el, echo_txt, call_for_seq):
        seated.append((seat, call_for_seq))
        canonical.append(canon_el)
        echo.append(f"{seat}:{echo_txt}")

    def auction_complete():
        has_bid = any(call_core(c) != "P" for _, c in seated)
        trailing = 0
        for _, c in reversed(seated):
            if call_core(c) == "P":
                trailing += 1
            else:
                break
        return (has_bid and trailing >= 3) or (not has_bid and len(seated) >= 4)

    def check_legal(call, seat, where):
        core = call_core(call)
        b = parse_bid(core)
        if b:
            highest = max([bid_rank(*parse_bid(c)) for _, c in seated if parse_bid(c)] + [-1])
            if bid_rank(*b) <= highest:
                raise ProblemError(f"{where}: {call} does not outrank the auction so far")
        elif core == "X":
            tgt = last_nonpass(seated)
            if not tgt or not parse_bid(tgt[1]) or same_side(tgt[0], seat):
                raise ProblemError(f"{where}: X (double) is not available here")
        elif core == "XX":
            tgt = last_nonpass(seated)
            if not tgt or call_core(tgt[1]) != "X" or same_side(tgt[0], seat):
                raise ProblemError(f"{where}: XX (redouble) is not available here")

    for si, step in enumerate(steps):
        where = f"auction step {si + 1}"
        seat, value = seat_key_of(step, where, allow_all=True)

        if seat == "ALL":
            if call_core(parse_call(value, where)) != "P":
                raise ProblemError(f"{where}: `all` may only be pass")
            while not auction_complete():
                emit(CLOCKWISE[idx % 4], {"call": "P"}, "P", "P")
                idx += 1
            break

        # The dealer makes the first call (never auto-filled): if the dealer
        # passes, that pass must be written out.
        if not seated and seat != dealer:
            raise ProblemError(f"{where}: the auction must start with the dealer "
                               f"({dealer}), but the first call is {seat}")
        # fill any skipped seats with Pass (seats between shown calls stayed silent)
        while CLOCKWISE[idx % 4] != seat:
            emit(CLOCKWISE[idx % 4], {"call": "P"}, "P", "P")
            idx += 1

        if value == "?":
            if seat != player:
                raise ProblemError(f"{where}: a question must be the player's seat ({player}), not {seat}")
            qn += 1
            q, ans = build_question(step, where, f"b{qn}", parse_call, "enter_bid")
            check_legal(ans, seat, f"{where} answer")
            emit(seat, {"question": q}, f"?(={ans})", ans)
        else:
            call = parse_call(value, where)
            check_legal(call, seat, where)
            emit(seat, {"call": call}, call, call)
        idx += 1

    # A stated contract implies the auction closed: add the trailing passes if the
    # author ended on the last bid rather than writing them (or `all: p`).
    if close:
        while not auction_complete():
            emit(CLOCKWISE[idx % 4], {"call": "P"}, "P", "P")
            idx += 1

    return canonical, " ".join(echo), compute_final_contract(seated)


# --- play -------------------------------------------------------------------
def process_play(steps, player):
    """Flat play list -> tricks of four (schema.v1.json play array). Legality is
    validated separately by validate_play once the deal/contract are known."""
    if not steps:
        return None
    cards, qn = [], 0
    for si, step in enumerate(steps):
        where = f"play {si + 1}"
        seat, value = seat_key_of(step, where, allow_all=False)
        if value == "?":
            if seat != player:
                raise ProblemError(f"{where}: a question must be the player's seat ({player}), not {seat}")
            qn += 1
            q, _ = build_question(step, where, f"c{qn}", parse_card, "enter_card")
            cards.append({"seat": seat, "question": q})
        else:
            cards.append({"seat": seat, "card": parse_card(value, where)})
    return [{"cards": cards[i:i + 4]} for i in range(0, len(cards), 4)]


def played_card(entry):
    """The card actually played by a move: the card, or a question's answer."""
    return entry.get("card") or entry["question"]["answer"]


def validate_play(play, deal, trump, declarer, where):
    """Check the recorded play against the bridge rules, as far as the known
    hands allow. Cheap checks (order, opening lead, no card twice) always run;
    hand-dependent ones (card-in-hand, follow-suit) run per seat where the hand
    is known; trick-winner-leads-next runs when the trump strain is known.
    """
    # A problem that doesn't show all four hands can only pose the opening lead —
    # a single play that is a question. Anything more (a recorded trick with cards
    # from hands we don't have) isn't supported.
    if not all(s in deal for s in ("N", "E", "S", "W")):
        moves = [c for t in play for c in t["cards"]]
        if len(moves) != 1 or "question" not in moves[0]:
            raise ProblemError(f"{where}: without all four hands, the play may record "
                               f"only the lead (one play, a question), got {len(moves)}")

    remaining = {seat: dict(hand) for seat, hand in deal.items()}   # mutable copy
    played, prev_winner = set(), None

    for ti, trick in enumerate(play):
        cards = trick["cards"]
        leader = cards[0]["seat"]
        if ti == 0 and declarer is not None:
            expected = CLOCKWISE[(CLOCKWISE.index(declarer) + 1) % 4]   # LHO of declarer
            if leader != expected:
                raise ProblemError(f"{where}: opening lead is {leader}, but LHO of "
                                   f"declarer {declarer} is {expected}")
        elif ti > 0 and trump is not None and prev_winner is not None and leader != prev_winner:
            raise ProblemError(f"{where}: trick {ti + 1} should be led by {prev_winner} "
                               f"(won the previous trick), got {leader}")

        led = None
        for pi, entry in enumerate(cards):
            seat = entry["seat"]
            expected = CLOCKWISE[(CLOCKWISE.index(leader) + pi) % 4]
            if seat != expected:
                raise ProblemError(f"{where}: trick {ti + 1} is out of order — "
                                   f"expected {expected} to play, got {seat}")
            card = played_card(entry)
            suit, rank = card[0], card[1:]
            if pi == 0:
                led = suit
            if seat in remaining:
                hold = remaining[seat]
                if rank not in hold.get(suit, ""):
                    raise ProblemError(f"{where}: {seat} has no {card}")
                if pi > 0 and suit != led and hold.get(led, ""):
                    raise ProblemError(f"{where}: {seat} must follow suit ({led}) but played {card}")
                hold[suit] = hold[suit].replace(rank, "")
            if card in played:
                raise ProblemError(f"{where}: {card} is played twice")
            played.add(card)

        if trump is not None and len(cards) == 4:
            prev_winner = trick_winner([(c["seat"], played_card(c)) for c in cards], trump)


RANKS = "AKQJT98765432"


def trick_winner(cards, trump):
    """Winning seat of a complete trick — mirrors trickWinner() in src/lib/play.ts.
    `cards` is a list of (seat, card); `trump` is a strain ('NT' = no trump)."""
    led = cards[0][1][0]
    best_seat, best_card = cards[0]
    for seat, card in cards[1:]:
        suit, bsuit = card[0], best_card[0]
        c_tr, b_tr = trump != "NT" and suit == trump, trump != "NT" and bsuit == trump
        better = (RANKS.index(card[1]) < RANKS.index(best_card[1]))   # higher rank
        if c_tr and not b_tr:
            best_seat, best_card = seat, card
        elif c_tr == b_tr and suit == led and bsuit == led and better:
            best_seat, best_card = seat, card
        elif c_tr and b_tr and better:
            best_seat, best_card = seat, card
    return best_seat


# --- one problem ------------------------------------------------------------
def normalize_problem(p, ordinal, titles_tmpl, quiz_slug):
    where = f"problem #{ordinal}"
    dealer = p["dealer"].upper()
    player = p.get("player", "S").upper()

    # deal: single `hand` -> the player's seat; `hands` map -> named seats.
    deal, all_cards = {}, {}
    if "hand" in p:
        deal[player] = parse_hand(p["hand"], f"{where} hand")
    else:
        for raw_seat, val in p["hands"].items():
            seat = raw_seat.upper()
            if seat in deal:
                raise ProblemError(f"{where}: seat {seat} given twice")
            if str(val).strip() == "-":
                continue                     # intentionally omitted
            deal[seat] = parse_hand(val, f"{where} hand {seat}")
    for seat, hand in deal.items():
        for suit, holding in hand.items():
            for r in holding:
                card = f"{suit}{r}"
                if card in all_cards:
                    raise ProblemError(f"{where}: {card} is in both {all_cards[card]} and {seat}")
                all_cards[card] = seat

    has_auction = bool(p.get("auction"))
    auction, echo, final = process_auction(
        p.get("auction", []), dealer, player, close=has_auction and bool(p.get("contract")))

    contract_txt, declarer, trump = None, None, None
    if p.get("contract"):
        contract_txt, c_level, c_strain, c_doubled, declarer = normalize_contract(p["contract"], where)
        trump = c_strain
        if has_auction:
            # With an auction, the contract must be its final contract.
            if final is None:
                raise ProblemError(f"{where}: contract {contract_txt} given, but the auction is passed out")
            if (c_level, c_strain, declarer, c_doubled) != final:
                f_txt = f"{final[0]}{final[1]}{final[3]} {final[2]}"
                raise ProblemError(f"{where}: contract {contract_txt} does not match the "
                                   f"auction's final contract {f_txt}")
        # else: no auction supplied — the contract stands on its own.
    elif final is not None:
        declarer, trump = final[2], final[1]   # derive for the leader / trick-winner checks

    play = process_play(p.get("plays", []), player)
    if play:
        if declarer is None:
            raise ProblemError(f"{where}: a play needs a contract, or an auction that reaches one")
        validate_play(play, deal, trump, declarer, where)

    title = (titles_tmpl.replace("#", f"#{ordinal}")
             if "#" in titles_tmpl else f"{titles_tmpl} #{ordinal}")

    return {
        "slug": f"{quiz_slug}.{ordinal}",
        "title": title,
        "ordinal": ordinal,
        "hero": player,
        "dealer": dealer,
        "vulnerability": normalize_vuln(p.get("vuln"), player),
        "deal": deal,
        "auction": auction,
        "play": play,
        "contract": contract_txt,
    }, echo


# --- driver -----------------------------------------------------------------
def schema_precheck(doc):
    try:
        import jsonschema
    except ImportError:
        print("note: `jsonschema` not installed — skipping structural pre-check "
              "(pip install jsonschema).", file=sys.stderr)
        return []
    schema = json.load(open(SCHEMA_PATH, encoding="utf-8"))
    v = jsonschema.Draft202012Validator(schema)
    return [f"schema: {list(e.path)}: {e.message}" for e in v.iter_errors(doc)]


def normalize_document(doc, schema_check=True):
    """Normalize a parsed YAML document.

    Returns (output, errors, echoes): `output` is the canonical dict (or None if
    anything failed), `errors` is a list of human-readable messages, `echoes` is
    a list of (ordinal, expanded-auction) pairs for review. Pure — no I/O, no
    sys.exit — so tests can drive it directly.
    """
    errors = list(schema_precheck(doc)) if schema_check else []
    if errors:
        return None, errors, []

    try:
        source_title, source_slug = parse_source_or_quiz(doc["source"], "source")
        quiz_title, quiz_slug = parse_source_or_quiz(doc["quiz"], "quiz")
    except ProblemError as e:
        return None, [str(e)], []

    problems, echoes = [], []
    for i, p in enumerate(doc["problems"], start=1):
        try:
            norm, echo = normalize_problem(p, i, doc["titles"], quiz_slug)
            problems.append(norm)
            echoes.append((i, echo))
        except ProblemError as e:
            errors.append(str(e))
    if errors:
        return None, errors, echoes

    out = {
        "source": {"slug": source_slug, "title": source_title},
        "quiz": {"slug": quiz_slug, "title": quiz_title, "source": source_slug},
        "problems": problems,
    }
    return out, [], echoes


def document_sql(out):
    """Upsert SQL for a normalized document, via the shared db/emit_sql.py."""
    quiz = out["quiz"]
    problem_rows = [
        {"slug": p["slug"], "title": p["title"], "source": quiz["source"],
         "difficulty": None, "tags": [], "hero": p["hero"], "dealer": p["dealer"],
         "vulnerability": p["vulnerability"], "deal": p["deal"], "auction": p["auction"],
         "play": p["play"], "contract": p["contract"], "commentary": None}
        for p in out["problems"]
    ]
    link_rows = [{"quiz_slug": quiz["slug"], "problem_slug": p["slug"], "ordinal": p["ordinal"]}
                 for p in out["problems"]]
    return emit_sql([out["source"]], [quiz], problem_rows, link_rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--sql", action="store_true",
                    help="emit upsert SQL instead of JSON")
    ap.add_argument("--review", action="store_true",
                    help="print each problem's expanded auction to stderr")
    args = ap.parse_args()

    try:
        import yaml
    except ImportError:
        sys.exit("error: PyYAML is required (pip install pyyaml).")
    doc = yaml.safe_load(open(args.file, encoding="utf-8"))

    out, errors, echoes = normalize_document(doc)
    if errors:
        _fail(errors)

    print(document_sql(out), end="") if args.sql else \
        print(json.dumps(out, indent=2, ensure_ascii=False))

    if args.review:
        print(f"\nexpanded auctions ({len(out['problems'])} problem(s)):", file=sys.stderr)
        for i, echo in echoes:
            print(f"  #{i}: {echo or '(none)'}", file=sys.stderr)


def _fail(errors):
    print("normalize failed — fix the source and re-run:", file=sys.stderr)
    for e in errors:
        print(f"  - {e}", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
