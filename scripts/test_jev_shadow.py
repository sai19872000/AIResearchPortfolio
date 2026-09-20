"""test_jev_shadow.py — the opt-in Jev shadow scorer in research_scout.

Run: python3 scripts/test_jev_shadow.py

Jev (TypeSafe AI "System One") is a typed-decision classifier: Choice/Score/Noul
answers with probabilities, no generated text. The scout's assessor and skeptic
already reduce to typed fields — relevance/quality/importance/novelty 0-10,
recommend true/false, severity low|medium|high, stillWorthIt true/false — which
is exactly Jev's shape. Today each of those costs a headless claude-sonnet-5 run.

This is SHADOW mode, deliberately: Jev's answers ride ALONGSIDE the Claude
verdict for comparison and change no decision. The vendor's accuracy numbers are
measured against their own model-derived reference rather than human labels, so
Jev earns the seat on real blog candidates before it gets one.

Proves:
  - jev_gate never raises and returns None whenever it cannot answer (no SDK, no
    key, transport error, malformed reply) — the scout tick must not be able to
    fail on an advisory signal;
  - mixed Score/Choice/Noul questions come back typed and normalized;
  - the scout is DARK by default: no flag, no Jev call, no 'jev' key;
  - with BLOG_JEV_SHADOW=1 the shadow rides in verdict['jev'] while the Claude
    verdict, _score, _recommended and _drop are untouched;
  - a Jev failure mid-gate leaves the selection identical.
Offline: the Jev client is stubbed throughout; no network, no Firestore, no claude.
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import jev_gate  # noqa: E402
import research_scout as rs  # noqa: E402

PASS = FAIL = 0


def ok(cond, msg):
    global PASS, FAIL
    if cond:
        PASS += 1; print(f"ok  {msg}")
    else:
        FAIL += 1; print(f"FAIL  {msg}")


SPECS = {
    "relevance": {"type": "score", "instructions": "Fit for practitioners.",
                  "criteria": ["None", "Weak", "Fair", "Good", "Strong"]},
    "recommend": {"type": "noul", "instructions": "Worth a post?"},
    "severity": {"type": "choice", "instructions": "How damning is the case against?",
                 "criteria": {"low": "minor", "medium": "real", "high": "disqualifying"}},
}


class _Score:
    def __init__(self, s, n=5):
        self.score, self.confidence = s, 0.6
        self.legend = {i: f"L{i}" for i in range(n)}
        self.probabilities = {i: 1.0 / n for i in range(n)}


class _Noul:
    def __init__(self, v):
        self.noul = v


class _Choice:
    def __init__(self, c):
        self.choice, self.confidence = c, 0.7
        self.probabilities = {c: 0.7}


class _Resp:
    def __init__(self, answers):
        self.answers = answers


def _client(answers):
    class C:
        def __init__(self, **kw):
            pass

        def system_one(self, state, questions, **kw):
            return _Resp(answers)
    return C


# ── jev_gate: typed, normalized, never raises ────────────────────────────────
ok(jev_gate.MODEL != "jev-latest" and jev_gate.MODEL.startswith("jev-"),
   f"model is pinned, not the moving alias ({jev_gate.MODEL})")
ok(0 < jev_gate.TIMEOUT <= 2.0 and 0 < jev_gate.RETRY_BUDGET <= 5.0,
   f"timeout/retry bounded far under the SDK's 10s/30s defaults "
   f"({jev_gate.TIMEOUT}/{jev_gate.RETRY_BUDGET})")

got = jev_gate.ask("some paper", SPECS, _client_factory=_client(
    {"relevance": _Score(4.0), "recommend": _Noul(0.82), "severity": _Choice("high")}))
ok(got == {"relevance": 10.0, "recommend": 0.82, "severity": "high"},
   f"mixed Score/Choice/Noul come back typed, score normalized to 0-10 ({got})")

clamped = jev_gate.ask("x", SPECS, _client_factory=_client(
    {"relevance": _Score(9.0), "recommend": _Noul(0.1), "severity": _Choice("low")}))
ok(clamped and clamped["relevance"] == 10.0,
   f"an out-of-range score clamps to 0-10 ({clamped})")


class _Boom:
    def __init__(self, **kw):
        raise RuntimeError("no creds")


ok(jev_gate.ask("x", SPECS, _client_factory=_Boom) is None,
   "ask() returns None (never raises) when the client cannot be built")


class _BoomCall:
    def __init__(self, **kw):
        pass

    def system_one(self, *a, **k):
        raise TimeoutError("529")


ok(jev_gate.ask("x", SPECS, _client_factory=_BoomCall) is None,
   "ask() returns None when the call fails")
ok(jev_gate.ask("x", SPECS, _client_factory=_client("not-a-mapping")) is None,
   "ask() returns None when answers is not a mapping")
part = jev_gate.ask("x", SPECS, _client_factory=_client({"relevance": _Score(2.0)}))
ok(part == {"relevance": 5.0},
   f"a missing answer is dropped, the rest survive ({part})")

os.environ.pop("TYPESAFE_API_KEY", None)
ok(jev_gate.available() is False, "available() is False with no key")
ok(jev_gate.ask("x", SPECS) is None, "ask() is None when unavailable")

# ── the scout: dark by default ───────────────────────────────────────────────
CAND = {"title": "A Paper", "source_id": "sid-1", "kind": "research",
        "source": "arxiv", "url": "u", "abstract": "an abstract",
        "signals": {}, "authors": []}
VERDICT = {"relevance": 7, "quality": 7, "importance": 8, "novelty": 6,
           "summary": "s", "concerns": [], "recommend": True, "confidence": 7}

calls = []


def _spy(state, specs, **kw):
    calls.append(state)
    return {"relevance": 9.0, "quality": 9.0, "importance": 9.0, "novelty": 9.0,
            "recommend": 0.91, "severity": "low", "stillWorthIt": 0.8}


rs._jev_ask = _spy
os.environ.pop("BLOG_JEV_SHADOW", None)
c = dict(CAND, verdict=dict(VERDICT))
rs.jev_shadow(c)
ok(calls == [], "flag unset: Jev is never called")
ok("jev" not in c["verdict"], "flag unset: no 'jev' key on the verdict")

# ── enabled: shadow rides alongside, decision untouched ──────────────────────
os.environ["BLOG_JEV_SHADOW"] = "1"
calls.clear()
c2 = dict(CAND, verdict=dict(VERDICT))
c2["_score"], c2["_recommended"] = rs._score(VERDICT), True
before = (dict(c2["verdict"]), c2["_score"], c2["_recommended"])
rs.jev_shadow(c2)
ok(len(calls) == 1, "enabled: exactly ONE batched Jev call per candidate")
ok(isinstance(c2["verdict"].get("jev"), dict) and c2["verdict"]["jev"]["relevance"] == 9.0,
   f"enabled: shadow lands in verdict['jev'] ({c2['verdict'].get('jev')})")
ok(c2["_score"] == before[1] and c2["_recommended"] == before[2],
   "enabled: _score and _recommended are UNCHANGED (shadow, not replacement)")
ok(all(c2["verdict"][k] == before[0][k] for k in before[0]),
   "enabled: every Claude verdict field is byte-identical")
ok("title" in calls[0] and "abstract" in calls[0].lower(),
   "the Jev state carries the same title+abstract the assessor judged")

# ── every Jev failure leaves the candidate untouched ─────────────────────────
rs._jev_ask = lambda state, specs, **kw: None
c3 = dict(CAND, verdict=dict(VERDICT))
rs.jev_shadow(c3)
ok("jev" not in c3["verdict"], "Jev returning None: no 'jev' key, no error")


def _raise(state, specs, **kw):
    raise RuntimeError("upstream down")


rs._jev_ask = _raise
c4 = dict(CAND, verdict=dict(VERDICT))
rs.jev_shadow(c4)          # must not propagate
ok("jev" not in c4["verdict"], "Jev raising: swallowed, candidate untouched")

# ── the shadow must be RECORDED, or it is a bill with no data ────────────────
rs._jev_ask = _spy
c5 = dict(CAND, verdict=dict(VERDICT))
rs.jev_shadow(c5)
ok(json.dumps(c5["verdict"]).count("jev") >= 1,
   "the shadow is inside `verdict`, which write_recs persists to Firestore whole")

# ── WIDENED SAMPLE: every assessed candidate is logged, not just the 2-3 picked ─
# Jev is already called on all ~16 finalists (8 papers + 8 announcements) inside
# gate(), but write_recs only persists the <=3 that _select_final returns. That
# throws away 80% of a comparison we have already paid for. jev_log writes one
# paired record per ASSESSED candidate.
import tempfile  # noqa: E402

os.environ["BLOG_JEV_SHADOW"] = "1"
logdir = Path(tempfile.mkdtemp(prefix="jevlog-"))
rs.JEV_LOG = logdir / "jev_shadow.jsonl"


def _cand(n, score, rec, jev=True):
    c = dict(CAND, title=f"cand-{n}", source_id=f"sid-{n}")
    c["verdict"] = dict(VERDICT, importance=score, relevance=score)
    if jev:
        c["verdict"]["jev"] = {"relevance": 9.0, "importance": 9.0, "recommend": 0.9,
                               "severity": "low", "stillWorthIt": 0.8}
    c["_score"] = rs._score(c["verdict"])
    c["_recommended"] = rec
    return c


assessed = [_cand(1, 9, True), _cand(2, 8, True), _cand(3, 2, False),
            _cand(4, 1, False, jev=False)]
selected = [assessed[0], assessed[1]]
rs.jev_log(assessed, selected)

lines = [json.loads(l) for l in rs.JEV_LOG.read_text().splitlines() if l.strip()]
ok(len(lines) == 4,
   f"one record per ASSESSED candidate, not per selected one ({len(lines)} of 4)")
ok(sum(1 for r in lines if r["selected"]) == 2,
   "each record says whether it was actually surfaced")
r1 = next(r for r in lines if r["title"] == "cand-1")
ok(r1["claude"]["importance"] == 9 and r1["jev"]["importance"] == 9.0,
   f"both sides are in the same record, side by side ({r1['claude']}, {r1['jev']})")
r4 = next(r for r in lines if r["title"] == "cand-4")
ok(r4["jev"] is None,
   "a candidate Jev abstained on is still logged, with jev=null — an abstention "
   "is data too")
ok(all("recommend" in r["claude"] and "severity" in r["jev"] for r in lines if r["jev"]),
   "the recommend/severity fields the drop rule uses are captured on both sides")

# appending across runs, not overwriting
rs.jev_log(assessed[:1], [])
lines2 = [l for l in rs.JEV_LOG.read_text().splitlines() if l.strip()]
ok(len(lines2) == 5, f"the log APPENDS across runs ({len(lines2)})")

# flag off -> nothing written
os.environ.pop("BLOG_JEV_SHADOW", None)
rs.JEV_LOG = logdir / "off.jsonl"
rs.jev_log(assessed, selected)
ok(not rs.JEV_LOG.exists(), "flag unset: no log file is created at all")

# unwritable path must not raise into the tick
os.environ["BLOG_JEV_SHADOW"] = "1"
rs.JEV_LOG = Path("/proc/nope/cannot/write.jsonl")
try:
    rs.jev_log(assessed, selected)
    ok(True, "an unwritable log path is swallowed, never raised into the scout tick")
except Exception as exc:
    ok(False, f"jev_log raised: {type(exc).__name__}: {exc}")
os.environ.pop("BLOG_JEV_SHADOW", None)

os.environ.pop("BLOG_JEV_SHADOW", None)
print(f"\n{'PASS' if FAIL == 0 else 'FAIL'} test_jev_shadow  ({PASS} passed, {FAIL} failed)")
sys.exit(1 if FAIL else 0)
