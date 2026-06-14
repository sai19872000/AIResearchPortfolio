#!/usr/bin/env python3
"""blog_watcher.py — the factory writer behind the /admin generator.

Polls Firestore `blogGenRequests` for queued items. For each, it runs the
blogger AGENTICALLY: a headless `claude` session (Max OAuth, no API key) writes
the post in Sai's voice AND uses the project `blog-art` skill to generate a hero
image + inline infographics with nano-banana, embedding them itself. The writer
drops the finished post as JSON; the watcher saves it as a DRAFT. Never
auto-publishes.

Run on the factory machine (needs `claude` + `agy` on the Ultra sub):
  python3 scripts/blog_watcher.py --once
  python3 scripts/blog_watcher.py --interval 30

Auth: gcloud (owner) ADC. Drops a stray GOOGLE_APPLICATION_CREDENTIALS so it
talks to auracle-prod-311. Generated art uploads to the public art bucket
(gs://saiteja-blog-art) so it shows on the live site immediately.
"""
from __future__ import annotations
import argparse, json, os, re, subprocess, sys, time, urllib.request
from pathlib import Path

os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

PROJECT = os.environ.get("FIRESTORE_PROJECT_ID", "auracle-prod-311")
DATABASE = os.environ.get("FIRESTORE_DATABASE_ID", "saiteja-site")
ROOT = Path(__file__).resolve().parent.parent
CLAUDE = os.environ.get("CLAUDE_BIN", "claude")
GENDIR = ROOT / ".gen"


def _db():
    from google.cloud import firestore
    return firestore.Client(project=PROJECT, database=DATABASE)


def _now() -> str:
    return subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%S.000Z"], capture_output=True, text=True).stdout.strip()


def slugify(s: str, limit: int = 70) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    if len(base) <= limit:
        return base or "post"
    cut = base[:limit]
    return (cut.rsplit("-", 1)[0] if "-" in cut else cut) or "post"  # no mid-word cut


def unique_slug(db, base: str) -> str:
    slug, n = base, 2
    while db.collection("blogPosts").document(slug).get().exists:
        slug = f"{base}-{n}"; n += 1
    return slug


def fetch_url_text(url: str, limit: int = 12000) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 saiteja-blog-watcher"})
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read(2_000_000).decode("utf-8", "ignore")
        text = re.sub(r"(?is)<(script|style|head).*?</\1>", " ", raw)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        return re.sub(r"\s+", " ", text).strip()[:limit]
    except Exception as e:
        return f"[could not fetch {url}: {e}]"


def write_brief(workdir: Path, req: dict, slug: str) -> None:
    opts = req.get("options", {}) or {}
    length = {"short": "~600 words", "deep": "~1800 words"}.get(opts.get("length"), "~1000 words")
    parts = [
        f"# Brief\n\nSLUG: {slug}\nTOPIC: {req['topic']}\nANGLE / NOTES: {req.get('angle') or '(none)'}",
        f"TARGET LENGTH: {length}\nTONE: {opts.get('tone') or 'technical and plain'}",
        "\n## Sources (cite where relevant; do not fabricate)\n",
    ]
    srcs = []
    for u in req.get("referenceUrls", []):
        srcs.append(f"### SOURCE url={u}\n{fetch_url_text(u)}")
    for r in req.get("references", []):
        srcs.append(f"### SOURCE pdf={r.get('title') or 'uploaded.pdf'}\n{(r.get('text') or '')[:12000]}")
    parts.append("\n\n".join(srcs) if srcs else "(no external sources provided)")
    workdir.mkdir(parents=True, exist_ok=True)
    (workdir / "brief.md").write_text("\n".join(parts))


TASK = """Read the brief at {wd}/brief.md and write a complete blog post for saiteja.ai.

Voice: you ARE Dr. Sai Teja Pusuluri — a PhD physicist who leads generative and agentic AI in production. Technical authority, specific over vague, first person, calm, editorial. No hype words (no "revolutionary", "seamless", "unleash", "game-changing"). No emoji. Markdown body with ## section headings; do NOT repeat the title as an H1.

Use the `blog-art` skill: generate exactly ONE hero image (use slug `{slug}`) and ONE to TWO inline infographics ONLY where a concept is genuinely clearer shown than told (skip infographics for a purely narrative post). Embed each infographic inline in the post markdown where it belongs, using the ART_URL the skill prints.

Cite the brief's sources where relevant with inline links; never fabricate sources or quotes.

When finished, write ONLY the final post as JSON to {wd}/post.json with EXACTLY these keys:
{{"title": "sentence case", "summary": "1-2 sentences", "content": "markdown body; infographics embedded as ![alt](ART_URL)", "tags": ["3-6 kebab-case"], "readTime": 7, "linkedinPost": "caption with 2-4 hashtags", "heroImage": "the hero ART_URL", "usedReferences": [{{"title": "...", "url": "... or null"}}]}}
Write the file; do not print the JSON to stdout. Do not publish."""


def run_blogger(workdir: Path, slug: str) -> dict:
    task = TASK.format(wd=workdir.as_posix(), slug=slug)
    # Scoped allowlist (NOT skip-all-permissions): file tools, the Skill tool,
    # and Bash limited to the art renderer. Anything else is denied, not run.
    allowed = ["Read", "Write", "Edit", "Glob", "Grep", "Skill",
               "Bash(python:*)", "Bash(python3:*)"]
    proc = subprocess.run(
        [CLAUDE, "-p", task, "--allowedTools", *allowed],
        cwd=str(ROOT), capture_output=True, text=True, timeout=1500,
    )
    out = workdir / "post.json"
    if not out.exists():
        tail = (proc.stdout or proc.stderr or "")[-400:]
        raise RuntimeError(f"writer produced no post.json (claude exit {proc.returncode}). tail: {tail}")
    return json.loads(out.read_text())


def process(db, doc) -> None:
    req = doc.to_dict()
    print(f"▶ generating: {req['topic'][:70]}")
    doc.reference.update({"status": "generating", "updatedAt": _now()})
    try:
        slug = unique_slug(db, slugify(req["topic"]))
        workdir = GENDIR / doc.id
        write_brief(workdir, req, slug)
        data = run_blogger(workdir, slug)
        now = _now()

        ref_ids = []
        for i, r in enumerate(data.get("usedReferences", []) or []):
            rid = f"{slug}-r{i+1}"
            db.collection("references").document(rid).set({
                "id": rid, "type": "url" if r.get("url") else "note",
                "title": r.get("title"), "url": r.get("url"),
                "contentSummary": None, "uploadedAt": now,
            })
            ref_ids.append(rid)

        db.collection("blogPosts").document(slug).set({
            "id": slug, "title": data["title"], "slug": slug,
            "summary": data.get("summary"), "content": data["content"],
            "tags": data.get("tags", []),
            "readTime": int(data.get("readTime") or 0) or None,
            "published": False, "publishedAt": None,
            "createdAt": now, "updatedAt": now,
            "linkedinPost": data.get("linkedinPost"), "twitterPost": None,
            "referenceIds": ref_ids, "imageIds": [],
            "heroImage": data.get("heroImage"), "diagrams": [],
            "generatedBy": "watcher", "genRequestId": doc.id,
        })
        doc.reference.update({"status": "ready", "resultSlug": slug, "error": None, "updatedAt": now})
        print(f"  ✓ draft ready: /admin/posts/{slug}")
    except Exception as e:
        print(f"  ✗ failed: {e}")
        doc.reference.update({"status": "failed", "error": str(e)[:400], "updatedAt": _now()})


def poll_once(db) -> int:
    from google.cloud.firestore_v1.base_query import FieldFilter
    docs = [d for d in db.collection("blogGenRequests").where(filter=FieldFilter("status", "==", "queued")).stream()]
    docs.sort(key=lambda d: d.to_dict().get("createdAt", ""))
    for d in docs:
        process(db, d)
    return len(docs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--interval", type=int, default=30)
    args = ap.parse_args()
    db = _db()
    if args.once:
        print(f"processed {poll_once(db)} request(s)")
        return
    print(f"watching blogGenRequests every {args.interval}s … (ctrl-c to stop)")
    while True:
        try:
            poll_once(db)
        except Exception as e:
            print(f"poll error: {e}")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
