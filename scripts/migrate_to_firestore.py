#!/usr/bin/env python3
"""One-shot loader: db_aiportfolio JSON export -> Firestore (saiteja-site).

Normalizes the Replit/Postgres export quirks (Python-repr tags, 'True'/'None'
strings), collapses the junction tables into arrays on each blog post, and
writes the portfolio content as a single doc. Idempotent: re-running overwrites
by stable doc id (slug for posts, numeric id for refs/images/subscribers).

Usage:
  python3 scripts/migrate_to_firestore.py [--export DIR] [--dry-run]
Auth: Application Default Credentials (gcloud auth application-default login).
"""
from __future__ import annotations
import argparse, ast, json, os, sys
from pathlib import Path

PROJECT = "auracle-prod-311"
DATABASE = "saiteja-site"
DEFAULT_EXPORT = "/home/sai/Downloads/db_aiportfolio"
REPO_ROOT = Path(__file__).resolve().parent.parent


def load(export: Path, name: str):
    p = export / f"{name}.json"
    if not p.exists():
        return []
    return json.loads(p.read_text() or "[]")


def parse_tags(raw):
    """tags arrive as a Python-repr string like "['a', 'b']" or None."""
    if not raw or raw in ("None", "[]"):
        return []
    if isinstance(raw, list):
        return raw
    try:
        val = ast.literal_eval(raw)
        return list(val) if isinstance(val, (list, tuple)) else [str(val)]
    except (ValueError, SyntaxError):
        return [t.strip() for t in str(raw).strip("[]").split(",") if t.strip()]


def clean_str(v):
    if v in (None, "None", ""):
        return None
    return v


def truthy(v):
    return str(v).strip().lower() in ("true", "1", "t", "yes")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", default=DEFAULT_EXPORT)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    export = Path(args.export)

    posts = load(export, "blog_posts")
    refs = load(export, "references")
    images = load(export, "images")
    bp_refs = load(export, "blog_post_references")
    bp_imgs = load(export, "blog_post_images")
    subs = load(export, "subscribers")

    # build junction maps: blog_post_id -> [reference_id], [image_id]
    ref_by_post: dict[str, list[str]] = {}
    for j in bp_refs:
        ref_by_post.setdefault(str(j["blog_post_id"]), []).append(str(j["reference_id"]))
    img_by_post: dict[str, list[str]] = {}
    for j in bp_imgs:
        img_by_post.setdefault(str(j["blog_post_id"]), []).append(str(j["image_id"]))

    docs = {"blogPosts": [], "references": [], "images": [], "subscribers": [], "portfolio": []}

    for p in posts:
        pid = str(p["id"])
        docs["blogPosts"].append((p["slug"], {
            "id": pid,
            "title": p["title"],
            "slug": p["slug"],
            "summary": clean_str(p.get("summary")),
            "content": p.get("content") or "",
            "tags": parse_tags(p.get("tags")),
            "readTime": int(p["read_time"]) if str(p.get("read_time", "")).isdigit() else None,
            "published": truthy(p.get("published")),
            "publishedAt": clean_str(p.get("published_at")),
            "createdAt": clean_str(p.get("created_at")),
            "updatedAt": clean_str(p.get("updated_at")),
            "linkedinPost": clean_str(p.get("linkedin_post")),
            "twitterPost": clean_str(p.get("twitter_post")),
            "referenceIds": ref_by_post.get(pid, []),
            "imageIds": img_by_post.get(pid, []),
            # art fields, filled in Phase 2:
            "heroImage": None,
            "diagrams": [],
        }))

    for r in refs:
        docs["references"].append((str(r["id"]), {
            "id": str(r["id"]),
            "type": clean_str(r.get("type")),
            "title": clean_str(r.get("title")),
            "originalFileName": clean_str(r.get("original_file_name")),
            "filePath": clean_str(r.get("file_path")),
            "url": clean_str(r.get("url")),
            "contentSummary": clean_str(r.get("content_summary")),
            "fileSize": r.get("file_size"),
            "mimeType": clean_str(r.get("mime_type")),
            "uploadedAt": clean_str(r.get("uploaded_at")),
        }))

    for im in images:
        docs["images"].append((str(im["id"]), {
            "id": str(im["id"]),
            "originalFileName": clean_str(im.get("original_file_name")),
            "storedFileName": clean_str(im.get("stored_file_name")),
            "filePath": clean_str(im.get("file_path")),
            "mimeType": clean_str(im.get("mime_type")),
            "fileSize": im.get("file_size"),
            "width": im.get("width"),
            "height": im.get("height"),
            "altText": clean_str(im.get("alt_text")),
            "caption": clean_str(im.get("caption")),
            "uploadedAt": clean_str(im.get("uploaded_at")),
        }))

    for s in subs:
        docs["subscribers"].append((str(s["id"]), {
            "id": str(s["id"]),
            "email": s.get("email"),
            "frequency": s.get("frequency"),
            "isActive": bool(s.get("is_active")),
            "createdAt": clean_str(s.get("created_at")),
        }))

    portfolio = json.loads((REPO_ROOT / "data" / "portfolio-content.json").read_text())
    docs["portfolio"].append(("main", portfolio))

    counts = {k: len(v) for k, v in docs.items()}
    print("Parsed:", counts)
    published = sum(1 for _, d in docs["blogPosts"] if d["published"])
    print(f"  blogPosts published={published} draft={len(docs['blogPosts'])-published}")

    if args.dry_run:
        sample = docs["blogPosts"][0][1] if docs["blogPosts"] else {}
        print("Sample post keys:", list(sample.keys()))
        print("Sample tags:", sample.get("tags"))
        return

    from google.cloud import firestore
    db = firestore.Client(project=PROJECT, database=DATABASE)
    total = 0
    for coll, items in docs.items():
        batch = db.batch()
        n = 0
        for doc_id, data in items:
            batch.set(db.collection(coll).document(str(doc_id)), data)
            n += 1
            if n % 400 == 0:
                batch.commit(); batch = db.batch()
        if n % 400 != 0:
            batch.commit()
        print(f"  wrote {n:>3} -> {coll}")
        total += n
    print(f"Done. {total} docs into {PROJECT}/{DATABASE}.")


if __name__ == "__main__":
    main()
