#!/usr/bin/env python3
"""blog_watcher.py — the factory writer behind the /admin generator.

Polls Firestore `blogGenRequests` for queued items, writes each one as a blog
post DRAFT using Claude on the Max subscription (the `claude` CLI, no API key,
no cost), generates a nano-banana hero image, and marks the request ready. The
draft then shows in /admin for review + publish.

Run locally on the factory machine (it needs the `claude` CLI + agy on the Ultra
sub). One-shot or loop:

  python3 scripts/blog_watcher.py --once
  python3 scripts/blog_watcher.py --interval 30      # poll forever

Auth: Application Default Credentials. This script drops a stray
GOOGLE_APPLICATION_CREDENTIALS so it uses your gcloud (owner) ADC on
auracle-prod-311. Note: generated hero art is written to public/art/blog/ and
appears on the DEPLOYED site after the next `scripts/deploy.sh` (text is live
immediately via runtime Firestore).
"""
from __future__ import annotations
import argparse, json, os, re, subprocess, sys, time, urllib.request
from pathlib import Path

# Use gcloud owner ADC, not a stray service-account key from another project.
os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

PROJECT = os.environ.get("FIRESTORE_PROJECT_ID", "auracle-prod-311")
DATABASE = os.environ.get("FIRESTORE_DATABASE_ID", "saiteja-site")
ROOT = Path(__file__).resolve().parent.parent
CLAUDE = os.environ.get("CLAUDE_BIN", "claude")


def _db():
    from google.cloud import firestore
    return firestore.Client(project=PROJECT, database=DATABASE)


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:80] or "post"


def fetch_url_text(url: str, limit: int = 12000) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 saiteja-blog-watcher"})
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read(2_000_000).decode("utf-8", "ignore")
        text = re.sub(r"(?is)<(script|style|head).*?</\1>", " ", raw)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:limit]
    except Exception as e:
        return f"[could not fetch {url}: {e}]"


VOICE = (
    "You write as Dr. Sai Teja Pusuluri — a PhD physicist who leads generative and "
    "agentic AI in production. Voice: technical authority, specific over vague, first "
    "person, calm and editorial. No hype words (no 'revolutionary', 'seamless', "
    "'unleash', 'game-changing'). Real specifics over adjectives. Markdown with clear "
    "section headings. No emoji."
)


def build_prompt(req: dict) -> str:
    refs = []
    for u in req.get("referenceUrls", []):
        refs.append(f"SOURCE (url={u}):\n{fetch_url_text(u)}")
    for r in req.get("references", []):
        title = r.get("title") or "uploaded.pdf"
        refs.append(f"SOURCE (pdf={title}):\n{(r.get('text') or '')[:12000]}")
    refs_block = "\n\n".join(refs) if refs else "(no external sources provided)"
    opts = req.get("options", {}) or {}
    length = {"short": "about 600 words", "deep": "about 1800 words"}.get(opts.get("length"), "about 1000 words")
    tone = opts.get("tone") or "technical and plain"

    return f"""{VOICE}

Write a complete blog post.

TOPIC: {req['topic']}
ANGLE / NOTES: {req.get('angle') or '(none)'}
TARGET LENGTH: {length}
TONE: {tone}

Use the sources below for facts and cite them by linking inline where relevant.
Do not fabricate sources or quotes. If a source is unreadable, ignore it.

{refs_block}

Return ONLY a single JSON object, no prose, no markdown fence, with EXACTLY these keys:
{{
  "title": "string, sentence case",
  "summary": "1-2 sentence dek",
  "content": "the full post body in markdown (## headings, lists, links). Do NOT repeat the title as an H1.",
  "tags": ["3-6 short kebab-case tags"],
  "readTime": integer_minutes,
  "linkedinPost": "a short LinkedIn caption in the same voice, with 2-4 hashtags",
  "usedReferences": [{{"title": "string", "url": "string or null"}}]
}}"""


def generate(prompt: str) -> dict:
    proc = subprocess.run([CLAUDE, "-p"], input=prompt, text=True,
                          capture_output=True, timeout=600)
    out = (proc.stdout or "").strip()
    if proc.returncode != 0:
        raise RuntimeError(f"claude exit {proc.returncode}: {(proc.stderr or out)[:300]}")
    # tolerate an accidental ```json fence
    m = re.search(r"\{.*\}", out, re.S)
    if not m:
        raise RuntimeError(f"no JSON in model output: {out[:300]}")
    return json.loads(m.group(0))


def gen_hero_art(slug: str, topic: str) -> str | None:
    try:
        subprocess.run([sys.executable, str(ROOT / "scripts" / "gen_art.py"), "hero", slug, topic],
                       check=True, timeout=600)
        p = ROOT / "public" / "art" / "blog" / f"{slug}-hero.png"
        return f"/art/blog/{slug}-hero.png" if p.exists() else None
    except Exception as e:
        print(f"  art failed (non-fatal): {e}")
        return None


def unique_slug(db, base: str) -> str:
    slug, n = base, 2
    while db.collection("blogPosts").document(slug).get().exists:
        slug = f"{base}-{n}"; n += 1
    return slug


def process(db, doc) -> None:
    req = doc.to_dict()
    rid = doc.id
    print(f"▶ generating: {req['topic'][:70]}")
    doc.reference.update({"status": "generating", "updatedAt": _now()})
    try:
        data = generate(build_prompt(req))
        slug = unique_slug(db, slugify(data["title"]))
        now = _now()

        # references
        ref_ids = []
        for i, r in enumerate(data.get("usedReferences", []) or []):
            ref_id = f"{slug}-r{i+1}"
            db.collection("references").document(ref_id).set({
                "id": ref_id, "type": "url" if r.get("url") else "note",
                "title": r.get("title"), "url": r.get("url"),
                "contentSummary": None, "uploadedAt": now,
            })
            ref_ids.append(ref_id)

        hero = gen_hero_art(slug, req["topic"])

        db.collection("blogPosts").document(slug).set({
            "id": slug, "title": data["title"], "slug": slug,
            "summary": data.get("summary"), "content": data["content"],
            "tags": data.get("tags", []),
            "readTime": int(data.get("readTime") or 0) or None,
            "published": False,  # DRAFT — Sai reviews + publishes in /admin
            "publishedAt": None, "createdAt": now, "updatedAt": now,
            "linkedinPost": data.get("linkedinPost"), "twitterPost": None,
            "referenceIds": ref_ids, "imageIds": [],
            "heroImage": hero, "diagrams": [],
            "generatedBy": "watcher", "genRequestId": rid,
        })
        doc.reference.update({"status": "ready", "resultSlug": slug, "error": None, "updatedAt": now})
        print(f"  ✓ draft ready: /admin/posts/{slug}")
    except Exception as e:
        print(f"  ✗ failed: {e}")
        doc.reference.update({"status": "failed", "error": str(e)[:300], "updatedAt": _now()})


def _now() -> str:
    # ISO timestamp; Date.now is fine here (plain script, not a workflow)
    return subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%S.000Z"], capture_output=True, text=True).stdout.strip()


def poll_once(db) -> int:
    from google.cloud.firestore_v1.base_query import FieldFilter
    docs = [d for d in db.collection("blogGenRequests")
            .where(filter=FieldFilter("status", "==", "queued")).stream()]
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
        n = poll_once(db)
        print(f"processed {n} request(s)")
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
