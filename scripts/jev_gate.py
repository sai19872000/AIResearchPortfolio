"""jev_gate.py — typed-decision calls to Jev (TypeSafe AI System One). ADVISORY.

Jev is a classifier, not a text model: it returns typed answers (Score / Choice /
Noul) with probabilities and generates nothing. It never owns control flow — the
scout's code asks it a question and stays in charge of the answer.

WHY IT IS HERE. research_scout's assessor and skeptic already reduce to typed
fields — relevance/quality/importance/novelty 0-10, recommend true/false,
severity low|medium|high, stillWorthIt true/false — and each of those currently
costs a headless claude-sonnet-5 run. That is exactly Jev's shape, and the
vendor measures a batched multi-question request at roughly an order of
magnitude cheaper and faster than one call per question.

Operational constraints, all from the vendor's own docs:
  - typesafe_sdk is imported LAZILY and is NOT a hard dependency. The blog
    services run on /home/linuxbrew/.linuxbrew/bin/python3 with no venv; absent
    package or absent TYPESAFE_API_KEY => available() is False and every call
    returns None, so this file is inert until someone installs it on purpose.
  - The SDK defaults are a latency cliff: 10.0s per HTTP op and a 30.0s total
    retry budget against a ~100ms happy path. Both are pinned far lower — an
    advisory signal must never stall the scout tick.
  - MODEL is pinned, not 'jev-latest': the alias moves on release and would
    silently shift any threshold tuned against it.
  - State is capped. Vendor: "Accuracy falls as the state grows with content
    unrelated to the decision."

PROMPT INJECTION. `state` here is scraped third-party text — arXiv abstracts,
lab blog posts, RSS. Jev's own docs list "injected instruction" and
"deliberately misleading framing" as failure modes that can move the answer, and
"cannot hallucinate" means the SCHEMA conforms, not that the answer is right. So
a Jev answer is data, never a directive, and while this module is in shadow mode
it decides nothing at all. Stdlib only.
"""
from __future__ import annotations

import os
from pathlib import Path  # noqa: F401  (kept for parity with sibling scripts)

# Pinned: 'jev-latest' moves on release and would drift tuned thresholds.
MODEL = "jev-1.13.0"

# Bounded well under the SDK defaults (10.0s per op / 30.0s total retry budget).
TIMEOUT = 1.0
RETRY_BUDGET = 2.0
MAX_RETRIES = 1

# Vendor: accuracy degrades as the state grows with irrelevant content.
MAX_STATE_CHARS = 12000


def available() -> bool:
    """True only if the SDK is installed AND a key is present. Never raises."""
    if not os.environ.get("TYPESAFE_API_KEY", "").strip():
        return False
    try:
        import typesafe_sdk  # noqa: F401
    except Exception:
        return False
    return True


def _default_factory(**kwargs):
    from typesafe_sdk import TypeSafeClient
    return TypeSafeClient(**kwargs)


def _client_kwargs() -> dict:
    kwargs = {"model": MODEL, "timeout": TIMEOUT}
    try:
        from typesafe_sdk import RetryPolicy
        kwargs["retry"] = RetryPolicy(max_retries=MAX_RETRIES, timeout=RETRY_BUDGET)
    except Exception:
        kwargs["retry"] = {"max_retries": MAX_RETRIES, "timeout": RETRY_BUDGET}
    return kwargs


def _questions(specs: dict) -> dict:
    """Build SDK question objects. Falls back to plain dicts without the SDK so
    the test seam can exercise every path with no package installed."""
    try:
        from typesafe_sdk import Choice, Noul, Score
    except Exception:
        return {k: dict(v) for k, v in specs.items()}
    out = {}
    for name, s in specs.items():
        kind, instr = s.get("type"), s.get("instructions", "")
        if kind == "score":
            out[name] = Score(instructions=instr, criteria=list(s["criteria"]))
        elif kind == "choice":
            out[name] = Choice(instructions=instr, criteria=dict(s["criteria"]))
        else:
            out[name] = Noul(instructions=instr)
    return out


def _value(spec: dict, ans):
    """One typed answer -> a plain Python value, or None if unreadable."""
    kind = spec.get("type")
    if kind == "score":
        steps = len(spec["criteria"]) - 1
        raw = float(ans.score) / steps * 10.0 if steps > 0 else 0.0
        return round(max(0.0, min(10.0, raw)), 2)   # clamp, as the scout does
    if kind == "choice":
        return str(ans.choice)
    return round(float(ans.noul), 4)


def ask(state: str, specs: dict, *, _client_factory=None) -> dict | None:
    """One batched call: {name: value}, or None on ANY failure.

    `specs` is {name: {"type": "score"|"choice"|"noul", "instructions": str,
    "criteria": [low..high] for score / {label: meaning} for choice}}.
    Scores are normalized onto the scout's 0-10 scale and clamped; a choice
    returns its label; a noul returns P(true).

    Batching is the intended usage — the vendor measures 13 questions in one
    request at ~11.5x cheaper and ~9.6x faster than 13 separate calls.

    NEVER raises: the scout tick must not be able to fail on an advisory signal.
    """
    factory = _client_factory or (_default_factory if available() else None)
    if factory is None:
        return None
    # STRUCTURAL failure (transport, auth, or a reply that is not shaped like
    # one) distrusts the whole response.
    try:
        client = factory(**_client_kwargs())
        resp = client.system_one(state=state[:MAX_STATE_CHARS],
                                 questions=_questions(specs))
        answers = resp.answers
        if not isinstance(answers, dict):
            return None
    except Exception:
        return None

    # PER-ANSWER failure drops just that answer: one abstain must not destroy
    # the rest of a batch, exactly as a missing answer does not.
    out: dict = {}
    for name, spec in specs.items():
        ans = answers.get(name)
        if ans is None:
            continue
        try:
            out[name] = _value(spec, ans)
        except Exception:
            continue
    return out or None
