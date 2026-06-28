#!/usr/bin/env python3
"""research_scout.py — proactive research/announcement scout for the blogger.

Daily one-shot. Discovers new AI/ML research (arXiv, Hugging Face Daily Papers)
and big-lab announcements (OpenAI, Anthropic, Google/DeepMind), runs a FUNNEL —
cheap signal prefilter, then a deep multi-agent gate (assessor + adversarial
skeptic + deterministic judge) via headless `claude` (Max OAuth, no API key) —
and writes the top 1-3 survivors to Firestore `researchCandidates` as
`recommended`. It never posts: @Bloggersaibot picks the recommendations up and
asks Sai to approve (then the existing draft -> publish pipeline takes over).

  python3 scripts/research_scout.py --once          # discover + gate + write recs
  python3 scripts/research_scout.py --once --dry-run # no Firestore writes; print
  python3 scripts/research_scout.py --once --no-gate # prefilter only (debug)

Auth: gcloud (owner) ADC; drops a stray GOOGLE_APPLICATION_CREDENTIALS so it
talks to auracle-prod-311 (same as the watcher).
"""
from __future__ import annotations
import argparse, html, json, os, re, subprocess, sys, time, urllib.parse, urllib.request
from pathlib import Path
from xml.etree import ElementTree as ET

os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

PROJECT = os.environ.get("FIRESTORE_PROJECT_ID", "auracle-prod-311")
DATABASE = os.environ.get("FIRESTORE_DATABASE_ID", "saiteja-site")
ROOT = Path(__file__).resolve().parent.parent
CLAUDE = os.environ.get("CLAUDE_BIN", "claude")
GENDIR = ROOT / ".gen" / "scout"
UA = {"User-Agent": "Mozilla/5.0 saiteja-research-scout"}

ARXIV_CATS = ["cs.AI", "cs.LG", "cs.CL", "cs.CV"]
LOOKBACK_DAYS = float(os.environ.get("SCOUT_LOOKBACK_DAYS", "2"))
PAPER_FINALISTS = int(os.environ.get("SCOUT_PAPER_FINALISTS", "8"))
ANN_FINALISTS = int(os.environ.get("SCOUT_ANN_FINALISTS", "5"))
SKEPTIC_TOP = int(os.environ.get("SCOUT_SKEPTIC_TOP", "3"))
MAX_RECS = int(os.environ.get("SCOUT_MAX_RECS", "3"))
# Always surface at least this many picks for Sai to review. Threshold-first: bar-clearing
# recommendations win; on a thin day we backfill with the top sub-bar finalists (flagged
# belowBar) so the 8am sweep is never silent. Set 0 to restore strict quality-or-nothing.
DAILY_FLOOR = int(os.environ.get("SCOUT_DAILY_FLOOR", "2"))

# Niche relevance (broader AI/ML): high-weight core terms + adjacent terms.
KW_CORE = ["agent", "agentic", "llm", "language model", "multi-agent", "tool use",
           "tool-use", "rag", "retrieval-augmented", "fine-tun", "lora", "qlora",
           "quantization", "quantize", "inference", "vllm", "reasoning",
           "chain-of-thought", "mixture-of-experts", "moe", "diffusion",
           "vision-language", "multimodal", "alignment", "rlhf", "evaluation",
           "benchmark", "transformer", "fine tuning", "prompt", "distillation",
           "context", "retrieval", "embedding", "code generation", "mcp"]
KW_ADJ = ["mlops", "databricks", "data pipeline", "feature store", "serving",
          "deployment", "production", "scalable", "latency", "throughput",
          "observability", "guardrail", "safety", "robustness", "dataset"]


# ── Firestore ─────────────────────────────────────────────────────────────────
def _db():
    from google.cloud import firestore
    return firestore.Client(project=PROJECT, database=DATABASE)


def _now() -> str:
    return subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%S.000Z"],
                          capture_output=True, text=True).stdout.strip()


def _cid(source_id: str) -> str:
    import hashlib
    return hashlib.sha1(source_id.encode()).hexdigest()[:16]


# ── small http helpers ────────────────────────────────────────────────────────
def _get(url: str, timeout: int = 25) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(4_000_000).decode("utf-8", "ignore")


def _get_json(url: str, timeout: int = 25):
    return json.loads(_get(url, timeout))


# ── source adapters → list[candidate] ─────────────────────────────────────────
# candidate = {kind, source, source_id, title, url, abstract, authors[], signals{}}
def src_arxiv() -> list[dict]:
    out = []
    q = "+OR+".join(f"cat:{c}" for c in ARXIV_CATS)
    url = ("https://export.arxiv.org/api/query?search_query=" + q +
           "&sortBy=submittedDate&sortOrder=descending&max_results=120")
    try:
        xml = _get(url)
    except Exception as e:
        print(f"  arxiv: {e}"); return out
    ns = {"a": "http://www.w3.org/2005/Atom"}
    for e in ET.fromstring(xml).findall("a:entry", ns):
        aid = (e.findtext("a:id", "", ns) or "").strip()
        title = re.sub(r"\s+", " ", (e.findtext("a:title", "", ns) or "")).strip()
        summ = re.sub(r"\s+", " ", (e.findtext("a:summary", "", ns) or "")).strip()
        authors = [a.findtext("a:name", "", ns) for a in e.findall("a:author", ns)][:8]
        pub = (e.findtext("a:published", "", ns) or "")
        if not (aid and title):
            continue
        m = re.search(r"abs/([0-9]+\.[0-9]+)", aid)
        bare = m.group(1) if m else aid
        out.append({"kind": "research", "source": "arxiv",
                    "source_id": f"arxiv:{bare}",
                    "title": title, "url": f"https://arxiv.org/abs/{bare}",
                    "abstract": summ, "authors": [a for a in authors if a],
                    "signals": {"published": pub}})
    return out


def src_hf_daily() -> list[dict]:
    out = []
    try:
        data = _get_json("https://huggingface.co/api/daily_papers?limit=60")
    except Exception as e:
        print(f"  hf_daily: {e}"); return out
    for row in data:
        p = row.get("paper") or row
        pid = p.get("id")
        if not pid:
            continue
        out.append({"kind": "research", "source": "hf_daily",
                    "source_id": f"arxiv:{pid}",
                    "title": re.sub(r"\s+", " ", p.get("title") or "").strip(),
                    "url": f"https://arxiv.org/abs/{pid}",
                    "abstract": (p.get("summary") or "").strip(),
                    "authors": [a.get("name") for a in (p.get("authors") or [])][:8],
                    "signals": {"upvotes": int(p.get("upvotes") or row.get("upvotes") or 0)}})
    return out


def _rss_items(url: str, source: str, limit: int = 15) -> list[dict]:
    out = []
    try:
        xml = _get(url)
    except Exception as e:
        print(f"  {source}: {e}"); return out
    try:
        root = ET.fromstring(xml)
    except Exception as e:
        print(f"  {source}: bad xml {e}"); return out
    # RSS <item> or Atom <entry>
    items = root.iter("item")
    for it in items:
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        desc = re.sub(r"(?s)<[^>]+>", " ", it.findtext("description") or "")
        if title and link:
            out.append({"kind": "announcement", "source": source, "source_id": link,
                        "title": html.unescape(title), "url": link,
                        "abstract": html.unescape(re.sub(r"\s+", " ", desc)).strip()[:1200],
                        "authors": [], "signals": {}})
    if not out:  # Atom fallback
        ns = {"a": "http://www.w3.org/2005/Atom"}
        for e in root.findall("a:entry", ns):
            title = (e.findtext("a:title", "", ns) or "").strip()
            link_el = e.find("a:link", ns)
            link = (link_el.get("href") if link_el is not None else "") or ""
            summ = re.sub(r"(?s)<[^>]+>", " ", e.findtext("a:summary", "", ns) or "")
            if title and link:
                out.append({"kind": "announcement", "source": source, "source_id": link,
                            "title": html.unescape(title), "url": link,
                            "abstract": html.unescape(re.sub(r"\s+", " ", summ)).strip()[:1200],
                            "authors": [], "signals": {}})
    return out[:limit]


def src_anthropic() -> list[dict]:
    """No clean RSS — best-effort parse of the news index for article links."""
    out = []
    try:
        h = _get("https://www.anthropic.com/news")
    except Exception as e:
        print(f"  anthropic: {e}"); return out
    seen = set()
    for m in re.finditer(r'href="(/news/[a-z0-9\-]+)"', h):
        path = m.group(1)
        if path in seen or path == "/news":
            continue
        seen.add(path)
        slug = path.rsplit("/", 1)[-1].replace("-", " ")
        out.append({"kind": "announcement", "source": "anthropic",
                    "source_id": "https://www.anthropic.com" + path,
                    "title": slug.title(),
                    "url": "https://www.anthropic.com" + path,
                    "abstract": "", "authors": [], "signals": {}})
    return out[:12]


def src_announcements() -> list[dict]:
    out = []
    out += _rss_items("https://openai.com/news/rss.xml", "openai")
    out += _rss_items("https://blog.google/technology/ai/rss/", "google")
    out += _rss_items("https://deepmind.google/blog/rss.xml", "google")
    out += src_anthropic()
    return out


def discover() -> list[dict]:
    cands = []
    for fn in (src_arxiv, src_hf_daily, src_announcements):
        got = fn()
        print(f"  {fn.__name__}: {len(got)}")
        cands += got
    # merge dups by source_id, preferring the one with richer signals (hf upvotes)
    by_id: dict[str, dict] = {}
    for c in cands:
        k = c["source_id"]
        if k not in by_id:
            by_id[k] = c
        else:
            by_id[k]["signals"].update(c["signals"])
    # second pass: the same paper can arrive under different ids (arxiv vs hf) —
    # collapse by normalized title, keeping the richer-abstract copy + merged signals.
    by_title: dict[str, dict] = {}
    for c in by_id.values():
        tk = _slugify(c["title"])
        if tk not in by_title:
            by_title[tk] = c
            continue
        keep = by_title[tk]
        merged = {**keep["signals"], **c["signals"]}
        if len(c.get("abstract") or "") > len(keep.get("abstract") or ""):
            c["signals"] = merged
            by_title[tk] = c
        else:
            keep["signals"] = merged
    return list(by_title.values())


# ── dedup ─────────────────────────────────────────────────────────────────────
def _slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:70]


def filter_seen(db, cands: list[dict]) -> list[dict]:
    seen_ids = set()
    if not getattr(filter_seen, "_skip_db", False):
        for d in db.collection("researchCandidates").stream():
            sid = d.to_dict().get("source_id")
            if sid:
                seen_ids.add(sid)
    blogged = set()
    for d in db.collection("blogPosts").stream():
        t = d.to_dict().get("title")
        if t:
            blogged.add(_slugify(t))
    out = []
    for c in cands:
        if c["source_id"] in seen_ids:
            continue
        if _slugify(c["title"]) in blogged:
            continue
        out.append(c)
    return out


# ── prefilter (no LLM) ────────────────────────────────────────────────────────
def _kw_score(text: str) -> float:
    t = text.lower()
    return 2.0 * sum(t.count(k) > 0 for k in KW_CORE) + 1.0 * sum(t.count(k) > 0 for k in KW_ADJ)


def prefilter(cands: list[dict]) -> tuple[list[dict], list[dict]]:
    for c in cands:
        title_kw = _kw_score(c["title"])
        body_kw = _kw_score(c.get("abstract") or "")
        upv = float(c["signals"].get("upvotes") or 0)
        score = 2.0 * title_kw + body_kw + min(upv, 50) / 5.0
        c["signals"]["keywordScore"] = title_kw + body_kw
        c["prefilterScore"] = round(score, 2)
    papers = sorted((c for c in cands if c["kind"] == "research"),
                    key=lambda c: c["prefilterScore"], reverse=True)
    anns = sorted((c for c in cands if c["kind"] == "announcement"),
                  key=lambda c: c["prefilterScore"], reverse=True)
    # announcements: require at least a little AI relevance so we skip non-AI google posts
    anns = [a for a in anns if a["signals"]["keywordScore"] >= 1 or a["source"] in ("openai", "anthropic")]
    return papers[:PAPER_FINALISTS], anns[:ANN_FINALISTS]


# ── deep gate (claude -p) ─────────────────────────────────────────────────────
def _run_agent(prompt: str, workdir: Path, out_name: str, timeout: int = 300) -> dict:
    workdir.mkdir(parents=True, exist_ok=True)
    allowed = ["Read", "Write", "Edit", "Glob", "Grep", "Bash(python:*)", "Bash(python3:*)"]
    proc = subprocess.run([CLAUDE, "-p", prompt, "--allowedTools", *allowed],
                          cwd=str(ROOT), capture_output=True, text=True, timeout=timeout)
    out = workdir / out_name
    if not out.exists():
        tail = (proc.stdout or proc.stderr or "")[-300:]
        raise RuntimeError(f"agent wrote no {out_name} (exit {proc.returncode}): {tail}")
    return json.loads(out.read_text())


ASSESS_PAPER = """You vet candidates for a TECHNICAL AI/ML blog with a HIGH bar — we only \
feature work that is authentic, methodologically sound, and genuinely important. \
Most papers are incremental; default to skepticism.

CANDIDATE ({source}):
title: {title}
authors: {authors}
abstract: {abstract}
signals: {signals}

Judge it on its merits. Write ONLY JSON to {wd}/verdict.json with keys:
{{"relevance": 0-10 (fit for a broad AI/ML practitioner audience), "quality": 0-10 \
(methodological soundness + evidence strength as far as the abstract shows), \
"importance": 0-10 (would this matter to builders; novelty and impact), \
"novelty": 0-10, "summary": "1-2 sentence plain-English why it matters", \
"concerns": ["short flags: overclaim risk, narrow eval, incremental, etc."], \
"recommend": true/false (is it worth a post), "confidence": 0-10}}
Be honest; a low score is the right call for most inputs."""

ASSESS_ANN = """You vet big-lab AI announcements for a technical blog's "info" posts. \
The source is the official lab, so authenticity is given — judge SIGNIFICANCE only \
(is this a real, notable release/result vs. minor PR).

ANNOUNCEMENT ({source}):
title: {title}
summary: {abstract}

Write ONLY JSON to {wd}/verdict.json:
{{"relevance": 0-10, "quality": 0-10, "importance": 0-10 (how big a deal), "novelty": 0-10, \
"summary": "1-2 sentence what shipped and why it matters", "concerns": [], \
"recommend": true/false, "confidence": 0-10}}"""

SKEPTIC = """You are an adversarial reviewer. Your job is to ARGUE AGAINST featuring this \
paper on a high-bar technical blog. Find the weakest points: overclaiming vs. evidence, \
narrow/cherry-picked evaluation, incremental delta over prior work, irreproducibility, or \
integrity concerns.

title: {title}
abstract: {abstract}
assessor_summary: {summary}

Write ONLY JSON to {wd}/skeptic.json:
{{"caseAgainst": "the single strongest reason to skip it (1-2 sentences)", \
"severity": "low" | "medium" | "high", "stillWorthIt": true/false}}"""


def assess(c: dict, wd: Path) -> dict | None:
    tmpl = ASSESS_ANN if c["kind"] == "announcement" else ASSESS_PAPER
    prompt = tmpl.format(wd=wd.as_posix(), source=c["source"], title=c["title"],
                         authors=", ".join(c.get("authors") or [])[:300],
                         abstract=(c.get("abstract") or "(none)")[:2500],
                         signals=json.dumps(c["signals"]))
    try:
        v = _run_agent(prompt, wd, "verdict.json")
        return v
    except Exception as e:
        print(f"    assess failed [{c['title'][:40]}]: {str(e)[:120]}")
        return None


def skeptic(c: dict, v: dict, wd: Path) -> dict:
    prompt = SKEPTIC.format(wd=wd.as_posix(), title=c["title"],
                            abstract=(c.get("abstract") or "")[:2500],
                            summary=v.get("summary", ""))
    try:
        return _run_agent(prompt, wd, "skeptic.json")
    except Exception as e:
        print(f"    skeptic failed: {str(e)[:120]}")
        return {"caseAgainst": "", "severity": "low", "stillWorthIt": True}


def _score(v: dict) -> float:
    return float(v.get("importance", 0)) * 0.6 + float(v.get("relevance", 0)) * 0.4


def _select_final(assessed: list[dict]) -> list[dict]:
    """Threshold-first DAILY FLOOR. If >= DAILY_FLOOR candidates cleared the bar
    (recommend:true and not skeptic-dropped), return the top MAX_RECS of them. Otherwise
    backfill with the highest-scoring sub-bar finalists up to DAILY_FLOOR, each flagged
    `verdict.belowBar=True`, so Sai always gets >= DAILY_FLOOR to review (he decides at
    review whether to post). Skeptic-dropped candidates are never surfaced."""
    pool = [c for c in assessed if not c.get("_drop")]
    cleared = sorted([c for c in pool if c.get("_recommended")],
                     key=lambda c: c["_score"], reverse=True)
    for c in cleared:
        c["verdict"]["belowBar"] = False
    if len(cleared) >= DAILY_FLOOR:
        return cleared[:MAX_RECS]
    chosen = list(cleared)
    for c in sorted([c for c in pool if not c.get("_recommended")],
                    key=lambda c: c["_score"], reverse=True):
        if len(chosen) >= DAILY_FLOOR:
            break
        c["verdict"]["belowBar"] = True
        chosen.append(c)
    chosen.sort(key=lambda c: c["_score"], reverse=True)
    return chosen


def gate(papers: list[dict], anns: list[dict]) -> list[dict]:
    # Assess every finalist and KEEP all valid verdicts (recommended or not), scored — so a
    # thin day can backfill the floor instead of returning nothing.
    assessed = []
    for c in papers + anns:
        wd = GENDIR / _cid(c["source_id"])
        v = assess(c, wd)
        if not v:
            continue
        c["verdict"] = {**v, "whyItMatters": v.get("summary", ""), "watchOut": ""}
        c["_score"] = _score(v)
        c["_recommended"] = bool(v.get("recommend"))
        assessed.append(c)
    # deep adversarial skeptic on the top BAR-CLEARING research candidates only
    cleared_research = sorted(
        [c for c in assessed if c.get("_recommended") and c["kind"] == "research"],
        key=lambda c: c["_score"], reverse=True)
    for c in cleared_research[:SKEPTIC_TOP]:
        sk = skeptic(c, c["verdict"], GENDIR / _cid(c["source_id"]))
        c["verdict"]["watchOut"] = sk.get("caseAgainst", "")
        if sk.get("severity") == "high" and not sk.get("stillWorthIt", True):
            c["_drop"] = True
            print(f"    skeptic dropped: {c['title'][:50]}")
    return _select_final(assessed)


# ── write recommendations ─────────────────────────────────────────────────────
def write_recs(db, recs: list[dict], dry: bool) -> None:
    now = _now()
    for c in recs:
        doc = {
            "kind": c["kind"], "source": c["source"], "source_id": c["source_id"],
            "title": c["title"], "url": c["url"], "abstract": (c.get("abstract") or "")[:2000],
            "authors": c.get("authors") or [], "signals": c["signals"],
            "prefilterScore": c.get("prefilterScore"), "verdict": c["verdict"],
            "belowBar": bool(c["verdict"].get("belowBar")),
            "status": "recommended", "notified": False,
            "tgKey": _cid(c["source_id"]), "createdAt": now,
        }
        tag = "floor pick (below bar)" if c["verdict"].get("belowBar") else "recommended"
        if dry:
            print(f"  [DRY] would surface ({tag}): {c['kind']} · {c['title'][:60]}  "
                  f"(imp {c['verdict'].get('importance')}, conf {c['verdict'].get('confidence')})")
            continue
        db.collection("researchCandidates").document(_cid(c["source_id"])).set(doc)
        print(f"  ✓ {tag}: {c['kind']} · {c['title'][:60]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-gate", action="store_true", help="prefilter only (debug)")
    args = ap.parse_args()

    db = None if args.dry_run else _db()
    if args.dry_run:  # still need a db for dedup unless skipped
        try:
            db = _db()
        except Exception:
            filter_seen._skip_db = True

    print("discover…")
    cands = discover()
    print(f"  total unique: {len(cands)}")
    cands = filter_seen(db, cands) if db else cands
    print(f"  after dedup: {len(cands)}")
    papers, anns = prefilter(cands)
    print(f"prefilter → {len(papers)} paper finalists, {len(anns)} announcement finalists")
    if args.no_gate:
        for c in (papers + anns):
            print(f"  {c['prefilterScore']:>5}  {c['kind'][:4]}  {c['title'][:70]}")
        return
    print("deep gate…")
    recs = gate(papers, anns)
    floor_n = sum(1 for c in recs if c["verdict"].get("belowBar"))
    print(f"→ {len(recs)} pick(s) for review "
          f"({len(recs) - floor_n} cleared the bar, {floor_n} floor backfill)")
    write_recs(db, recs, args.dry_run)
    print("done.")


if __name__ == "__main__":
    main()
