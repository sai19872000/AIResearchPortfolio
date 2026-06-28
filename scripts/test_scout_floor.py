"""test_scout_floor.py — the daily-floor selection in research_scout._select_final.

Sai's rule: threshold FIRST; if fewer than DAILY_FLOOR (2) candidates clear the bar, back
fill with the top-scoring sub-bar finalists up to the floor (flagged belowBar) so he always
gets >= 2 to review. _select_final is pure (no Firestore/claude) so this runs offline.

Run: python3 scripts/test_scout_floor.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import research_scout as rs  # noqa: E402


def _c(name, score, recommended, drop=False):
    return {"title": name, "source_id": name, "kind": "research",
            "_score": float(score), "_recommended": recommended, "_drop": drop,
            "verdict": {"importance": score, "confidence": score}}


def _names(res):
    return [c["title"] for c in res]


def test_enough_cleared_returns_top_maxrecs_no_floor():
    a = [_c("A", 9, True), _c("B", 8, True), _c("C", 7, True), _c("D", 6, True)]
    res = rs._select_final(a)
    assert len(res) == rs.MAX_RECS == 3, res            # capped at MAX_RECS
    assert _names(res) == ["A", "B", "C"]               # top scores
    assert all(c["verdict"]["belowBar"] is False for c in res)


def test_two_cleared_returns_both_no_backfill():
    a = [_c("A", 9, True), _c("B", 8, True), _c("Z", 5, False)]
    res = rs._select_final(a)
    assert _names(res) == ["A", "B"]
    assert all(not c["verdict"]["belowBar"] for c in res)  # Z not pulled in


def test_one_cleared_backfills_to_floor_flagged():
    a = [_c("A", 9, True), _c("X", 6, False), _c("Y", 4, False)]
    res = rs._select_final(a)
    assert len(res) == 2                                 # floor reached
    assert _names(res) == ["A", "X"]                     # A (cleared) + top sub-bar X
    flags = {c["title"]: c["verdict"]["belowBar"] for c in res}
    assert flags == {"A": False, "X": True}              # only the backfill is flagged


def test_zero_cleared_returns_top_two_below_bar():
    a = [_c("X", 7, False), _c("Y", 6, False), _c("Z", 3, False)]
    res = rs._select_final(a)
    assert _names(res) == ["X", "Y"]                     # top 2 by score
    assert all(c["verdict"]["belowBar"] for c in res)    # both flagged below bar


def test_thin_input_cannot_reach_floor_no_crash():
    a = [_c("X", 7, False)]
    res = rs._select_final(a)
    assert _names(res) == ["X"] and res[0]["verdict"]["belowBar"] is True


def test_skeptic_dropped_never_surfaced_even_as_floor():
    # A was recommended then skeptic-killed (_drop); must not appear, even though
    # there's nothing else cleared — backfill uses sub-bar B, not the dropped A.
    a = [_c("A", 9, True, drop=True), _c("B", 5, False)]
    res = rs._select_final(a)
    assert "A" not in _names(res)
    assert _names(res) == ["B"] and res[0]["verdict"]["belowBar"] is True


def test_gate_thin_day_backfills_to_floor_end_to_end():
    # Full gate() path with assess/skeptic stubbed (no LLM): only P1 clears the bar; the
    # gate must still surface 2 (P1 + the top sub-bar pick, flagged belowBar).
    verdicts = {
        "P1": {"importance": 9, "relevance": 8, "recommend": True, "confidence": 8, "summary": "x"},
        "P2": {"importance": 6, "relevance": 5, "recommend": False, "confidence": 4, "summary": "y"},
        "P3": {"importance": 5, "relevance": 4, "recommend": False, "confidence": 3, "summary": "z"},
    }
    rs.assess = lambda c, wd: verdicts.get(c["source_id"])
    rs.skeptic = lambda c, v, wd: {"caseAgainst": "", "severity": "low", "stillWorthIt": True}
    papers = [{"source_id": k, "title": k, "kind": "research", "signals": {}} for k in verdicts]
    res = rs.gate(papers, [])
    assert len(res) == 2, res                            # floor honored
    assert res[0]["source_id"] == "P1"                  # bar-clearer on top
    assert sum(1 for c in res if c["verdict"].get("belowBar")) == 1   # exactly one floor pick


if __name__ == "__main__":
    for name in ["test_enough_cleared_returns_top_maxrecs_no_floor",
                 "test_two_cleared_returns_both_no_backfill",
                 "test_one_cleared_backfills_to_floor_flagged",
                 "test_zero_cleared_returns_top_two_below_bar",
                 "test_thin_input_cannot_reach_floor_no_crash",
                 "test_skeptic_dropped_never_surfaced_even_as_floor",
                 "test_gate_thin_day_backfills_to_floor_end_to_end"]:
        globals()[name]()
        print(f"ok  {name}")
    print("PASS test_scout_floor")
