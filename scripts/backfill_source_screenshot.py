#!/usr/bin/env python3
"""Backfill the source-page screenshot (featured image) for existing posts.

For each PUBLISHED post that has a `sourceUrl` but no `sourceScreenshot`,
captures the original source page (scripts/capture_source.py) and sets
sourceScreenshot to the resulting URL. LinkedIn's Posts API cannot add
images to an already-published post, so this only updates the blog side.

  python3 scripts/backfill_source_screenshot.py            # only posts missing one
  python3 scripts/backfill_source_screenshot.py --force    # recapture every post's
  python3 scripts/backfill_source_screenshot.py --limit 5  # cap how many

Runs on the factory machine (needs google-chrome on disk).
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


def capture(slug: str, url: str) -> str | None:
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "capture_source.py"), slug, url],
                       capture_output=True, text=True, timeout=240)
    m = re.search(r"^ART_URL:\s*(\S+)", r.stdout, re.M)
    if m:
        return m.group(1)
    print(f"  ✗ capture failed: {((r.stdout or '') + (r.stderr or ''))[-300:]}")
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="recapture even if a sourceScreenshot exists")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    db = _db()

    from google.cloud.firestore_v1.base_query import FieldFilter
    posts = [p.to_dict() for p in db.collection("blogPosts")
             .where(filter=FieldFilter("published", "==", True)).stream()]
    posts.sort(key=lambda d: d.get("publishedAt") or "", reverse=True)
    todo = [p for p in posts if p.get("sourceUrl") and (args.force or not p.get("sourceScreenshot"))]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(todo)} post(s) to backfill (of {len(posts)} published)")

    done = 0
    for p in todo:
        slug = p["slug"]
        print(f"▶ {slug} ← {p['sourceUrl']}")
        url = capture(slug, p["sourceUrl"])
        if url:
            db.collection("blogPosts").document(slug).update({"sourceScreenshot": url})
            print(f"  ✓ {url}")
            done += 1
        else:
            print("  ✗ skipped")
    print(f"done: {done}/{len(todo)} sourceScreenshots set")


if __name__ == "__main__":
    main()
