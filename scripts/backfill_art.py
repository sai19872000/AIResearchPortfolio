#!/usr/bin/env python3
"""Backfill on-brand hero art for existing blog posts via nano-banana → GCS.

For each post, renders an Auracle hero from its title (scripts/gen_art.py, which
uploads to the public art bucket) and sets the post's heroImage to the URL.

  python3 scripts/backfill_art.py            # only posts missing a hero
  python3 scripts/backfill_art.py --force    # regenerate every post's hero
  python3 scripts/backfill_art.py --limit 5  # cap how many (credit control)

Runs on the factory machine (needs agy on the Ultra sub). Hero only — per-post
infographics for the back-catalogue are a heavier agentic pass (regenerate the
post through /admin for that).
"""
from __future__ import annotations
import argparse, os, re, subprocess, sys
from pathlib import Path

os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
ROOT = Path(__file__).resolve().parent.parent
PROJECT = os.environ.get("FIRESTORE_PROJECT_ID", "auracle-prod-311")
DATABASE = os.environ.get("FIRESTORE_DATABASE_ID", "saiteja-site")


def _db():
    from google.cloud import firestore
    return firestore.Client(project=PROJECT, database=DATABASE)


def gen_hero(slug: str, concept: str) -> str | None:
    """Render a hero via the blog-art renderer; return its public ART_URL."""
    p = subprocess.run([sys.executable, str(ROOT / "scripts" / "gen_art.py"), "hero", slug, concept],
                       capture_output=True, text=True, timeout=600)
    m = re.search(r"^ART_URL:\s*(\S+)", p.stdout, re.M)
    if m:
        return m.group(1)
    m = re.search(r"^ART_LOCAL:\s*(\S+)", p.stdout, re.M)
    return m.group(1) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="regenerate even if a hero exists")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    db = _db()

    posts = [p.to_dict() for p in db.collection("blogPosts").stream()]
    posts.sort(key=lambda d: d.get("publishedAt") or "", reverse=True)
    todo = [p for p in posts if args.force or not p.get("heroImage")]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(todo)} post(s) to backfill (of {len(posts)} total)")

    done = 0
    for p in todo:
        slug = p["slug"]
        print(f"▶ {slug}")
        url = gen_hero(slug, p["title"])
        if url:
            db.collection("blogPosts").document(slug).update({"heroImage": url})
            print(f"  ✓ {url}")
            done += 1
        else:
            print("  ✗ render failed — skipped")
    print(f"done: {done}/{len(todo)} heroes set")


if __name__ == "__main__":
    main()
