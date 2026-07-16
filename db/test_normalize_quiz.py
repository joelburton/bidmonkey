#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest", "pyyaml", "jsonschema"]
# ///
"""Tests for db/normalize_quiz.py.

    uv run db/test_normalize_quiz.py          # run the suite
    uv run db/test_normalize_quiz.py -k vuln  # pytest args pass through

Fixtures live in db/quiz_examples/: `clean.yaml` (happy paths) and one file per
check under `broken/` (each isolates a single failure).
"""
import os
import sys

import pytest
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import normalize_quiz as nq  # noqa: E402

EX = os.path.join(HERE, "quiz_examples")


def run(rel):
    with open(os.path.join(EX, rel), encoding="utf-8") as f:
        return nq.normalize_document(yaml.safe_load(f))


# --- happy path -------------------------------------------------------------
def test_clean_normalizes():
    out, errors, echoes = run("clean.yaml")
    assert errors == []
    assert out is not None
    assert out["source"] == {"slug": "ex", "title": "Example Source"}
    ps = out["problems"]
    assert len(ps) == 4
    assert [p["slug"] for p in ps] == [f"ex-q.{i}" for i in (1, 2, 3, 4)]
    assert [p["title"] for p in ps] == [f"Example #{i}" for i in (1, 2, 3, 4)]


def test_clean_p1_free_entry_and_ten():
    out, _, _ = run("clean.yaml")
    p = out["problems"][0]
    assert p["deal"] == {"S": {"S": "A65", "H": "KQ2", "D": "T53", "C": "AQJ9"}}
    q = p["auction"][0]["question"]
    assert q["choiceType"] == "enter_bid"
    assert q["answer"] == "1NT"
    assert q["accept"] == ["1C"]
    assert "options" not in q
    assert p["vulnerability"] is None       # omitted -> null (unspecified)
    assert p["play"] is None


def test_clean_p2_multiple_choice_and_ten_2char_and_them():
    out, _, _ = run("clean.yaml")
    p = out["problems"][1]
    assert p["deal"]["S"]["D"] == "T92"     # `1092` -> T,9,2
    q = p["auction"][0]["question"]
    assert q["choiceType"] == "multiple_choice"
    assert q["options"] == ["1H", "1NT", "2NT"]   # order preserved
    assert q["answer"] == "1NT"
    assert p["vulnerability"] == "ew"       # them, player S


def test_clean_p3_handsmap_allpass_contract_and_lead():
    out, _, echoes = run("clean.yaml")
    p = out["problems"][2]
    assert set(p["deal"]) == {"S"}          # omitted seats dropped
    assert p["vulnerability"] == "ns"       # us, player S
    assert p["contract"] == "1NT E"
    # all-pass expands to E's bid then three passes
    assert p["auction"] == [{"call": "1NT"}, {"call": "P"}, {"call": "P"}, {"call": "P"}]
    assert echoes[2][1] == "E:1NT S:P W:P N:P"
    lead = p["play"][0]["cards"][0]
    assert lead["seat"] == "S"
    assert lead["question"]["answer"] == "DK"       # `KD` -> D-K canonical
    assert lead["question"]["choiceType"] == "enter_card"


def test_clean_p4_one_skip_allowed():
    out, _, echoes = run("clean.yaml")
    p = out["problems"][3]
    # N opens, E (silent) filled with a pass, S answers
    assert p["auction"] == [{"call": "1C"}, {"call": "P"},
                            {"question": {"id": "b1", "choiceType": "enter_bid",
                                          "answer": "1H", "explanation": "Respond 1H."}}]
    assert echoes[3][1] == "N:1C E:P S:?(=1H)"


# --- one deliberately-broken file per check ---------------------------------
BROKEN = [
    ("broken/bad_hand_count.yaml", "not 13"),
    ("broken/bad_dup_in_hand.yaml", "twice in one hand"),
    ("broken/bad_dup_across_hands.yaml", "is in both"),
    ("broken/bad_suit_order.yaml", "in order"),
    ("broken/bad_question_seat.yaml", "player's seat"),
    ("broken/bad_skip.yaml", "skipped"),
    ("broken/bad_answer_not_in_choices.yaml", "not one of the choices"),
    ("broken/bad_accept_not_in_choices.yaml", "not among the choices"),
    ("broken/bad_leader.yaml", "opening lead"),
    ("broken/bad_question_no_answer.yaml", "needs an"),
    ("broken/bad_nonascending.yaml", "does not outrank"),
    ("broken/bad_double.yaml", "double"),
    ("broken/bad_redouble.yaml", "redouble"),
    ("broken/bad_contract_mismatch.yaml", "does not match"),
    ("broken/bad_card_not_in_hand.yaml", "has no"),
    ("broken/bad_revoke.yaml", "follow suit"),
    ("broken/bad_next_leader.yaml", "led by"),
    ("broken/bad_dup_card_play.yaml", "played twice"),
    ("broken/bad_call.yaml", "1Z"),
    ("broken/bad_seat_key.yaml", "x"),
    ("broken/bad_vuln.yaml", "v/-"),
    ("broken/bad_contract.yaml", "3NT"),
    ("broken/bad_both_hand_and_hands.yaml", ""),   # oneOf; just require failure
]


@pytest.mark.parametrize("rel,needle", BROKEN)
def test_broken_is_rejected(rel, needle):
    out, errors, _ = run(rel)
    assert out is None, f"{rel} should not normalize"
    assert errors, f"{rel} produced no error"
    joined = " ".join(errors)
    assert needle in joined, f"{rel}: {joined!r} does not mention {needle!r}"


# --- parser units (the typo-catching core) ----------------------------------
def test_parse_hand():
    assert nq.parse_hand("sa65 hkq2 dt53 caqj9", "x") == \
        {"S": "A65", "H": "KQ2", "D": "T53", "C": "AQJ9"}


def test_parse_hand_void():
    assert nq.parse_hand("s- hakqjt98765 d- c432", "x")["S"] == ""


@pytest.mark.parametrize("tok,want", [
    ("1nt", "1NT"), ("1N", "1NT"), ("Pass", "P"), ("p", "P"),
    ("x", "X"), ("XX", "XX"), ("1♠", "1S"), ("1NT*", "1NT"), ("3h", "3H"),
])
def test_parse_call(tok, want):
    assert nq.parse_call(tok, "x") == want


@pytest.mark.parametrize("tok,want", [
    ("3C", "C3"), ("ac", "CA"), ("10d", "DT"), ("KD", "DK"), ("2♥", "H2"),
])
def test_parse_card(tok, want):
    assert nq.parse_card(tok, "x") == want


@pytest.mark.parametrize("val,player,want", [
    ("us", "S", "ns"), ("us", "E", "ew"), ("them", "S", "ew"), ("them", "W", "ns"),
    ("all", "S", "both"), ("both", "S", "both"), (None, "S", None),
    ("-", "S", "none"), ("ns", "E", "ns"), ("ew", "S", "ew"),
])
def test_normalize_vuln(val, player, want):
    assert nq.normalize_vuln(val, player) == want


@pytest.mark.parametrize("cards,trump,want", [
    ([("E", "H2"), ("S", "H9"), ("W", "H5"), ("N", "H3")], "NT", "S"),   # high heart
    ([("E", "HA"), ("S", "SA"), ("W", "H5"), ("N", "H3")], "NT", "E"),   # off-suit can't win
    ([("E", "H2"), ("S", "SA"), ("W", "H5"), ("N", "H3")], "S", "S"),    # trump ruff wins
    ([("E", "HA"), ("S", "C2"), ("W", "D5"), ("N", "S3")], "S", "N"),    # only trump wins
])
def test_trick_winner(cards, trump, want):
    assert nq.trick_winner(cards, trump) == want


def test_validate_play_happy_two_tricks():
    # E wins trick 1 with the heart ace under no-trump, then correctly leads trick 2.
    deal = {"E": {"H": "A2"}, "S": {"H": "3"}, "W": {"H": "4"}, "N": {"H": "5"}}
    play = [
        {"cards": [{"seat": "E", "card": "HA"}, {"seat": "S", "card": "H3"},
                   {"seat": "W", "card": "H4"}, {"seat": "N", "card": "H5"}]},
        {"cards": [{"seat": "E", "card": "H2"}]},
    ]
    nq.validate_play(play, deal, "NT", "N", "x")   # declarer N -> LHO E leads; must not raise


def test_final_contract_declarer_is_first_of_side_to_name_strain():
    # W opens 1NT, E raises to 3NT: declarer is W (named NT first for the side).
    seated = [("W", "1NT"), ("N", "P"), ("E", "3NT"), ("S", "P"), ("W", "P"), ("N", "P")]
    assert nq.compute_final_contract(seated) == (3, "NT", "W", "")


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q", *sys.argv[1:]]))
