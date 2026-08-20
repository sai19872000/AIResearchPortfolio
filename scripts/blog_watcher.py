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
# PIN the writer's model. Headless `claude -p` inherits the OPERATOR'S default
# model — when that default became Fable 5 (2026-07-01), its stricter safety
# filters started rejecting normal blog briefs ("Claude Code can't respond to
# this request with Fable 5"), and every generation died with exit 1
# (requests ywQLZ93/hbyycqX, 07-04/05). Long-form writing is Sonnet-tier work;
# never let a user-preference change silently re-model a production pipeline.
WRITER_MODEL = os.environ.get("BLOG_WRITER_MODEL", "claude-sonnet-5")
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
    head = [f"# Brief\n\nSLUG: {slug}\nTOPIC: {req['topic']}\nANGLE / NOTES: {req.get('angle') or '(none)'}"]
    if req.get("kind"):
        head.append(f"POST KIND: {req['kind']}")
    if req.get("sourceUrl"):
        head.append(f"ORIGINAL SOURCE LINK (you MUST link this in the post): {req['sourceUrl']}")
    parts = [
        "\n".join(head),
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

Use the `blog-art` skill: generate exactly ONE hero image (use slug `{slug}`) AND at least ONE inline infographic that captures the post's core idea — a real diagram (architecture, pipeline, tradeoff, or comparison), since this infographic doubles as the LinkedIn visual. Add a second infographic only where another concept is clearer shown than told. Embed each infographic inline in the post markdown where it belongs, using the ART_URL the skill prints.

Cite the brief's sources where relevant with inline links; never fabricate sources or quotes.

If the brief gives an ORIGINAL SOURCE LINK, link to it explicitly near the top of the post (inline in the opening, and keep it in usedReferences) — every post must point readers to the primary source. If POST KIND is "announcement", write a tight INFORMATIONAL post — what shipped, why it matters, and a brief informed take, ~500-700 words — not a long research essay.

LinkedIn caption rule: the `linkedinPost` is NOT the blog body. Write it in a neutral, third-person framing that PRESENTS the post — a sharp hook about the idea, then a short line like "new post on <topic>". Do NOT use first person in the caption: no "I wrote", "I built", "my", "I think". (The blog body stays first person; only the caption avoids it.) 2-4 hashtags.

When finished, write ONLY the final post as JSON to {wd}/post.json with EXACTLY these keys:
{{"title": "sentence case", "summary": "1-2 sentences", "content": "markdown body; infographics embedded as ![alt](ART_URL)", "tags": ["3-6 kebab-case"], "readTime": 7, "linkedinPost": "neutral caption per the rule above, 2-4 hashtags", "heroImage": "the hero ART_URL", "usedReferences": [{{"title": "...", "url": "... or null"}}]}}
Write the file; do not print the JSON to stdout. Do not publish."""


def run_blogger(workdir: Path, slug: str) -> dict:
    task = TASK.format(wd=workdir.as_posix(), slug=slug)
    # Scoped allowlist (NOT skip-all-permissions): file tools, the Skill tool,
    # and Bash limited to the art renderer. Anything else is denied, not run.
    allowed = ["Read", "Write", "Edit", "Glob", "Grep", "Skill",
               "Bash(python:*)", "Bash(python3:*)"]
    proc = subprocess.run(
        [CLAUDE, "-p", task, "--model", WRITER_MODEL, "--allowedTools", *allowed],
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
            "sourceUrl": req.get("sourceUrl"), "kind": req.get("kind"),
        })
        doc.reference.update({"status": "ready", "resultSlug": slug, "error": None, "updatedAt": now})
        print(f"  ✓ draft ready: /admin/posts/{slug}")
    except Exception as e:
        print(f"  ✗ failed: {e}")
        doc.reference.update({"status": "failed", "error": str(e)[:400], "updatedAt": _now()})


def reset_stale(db) -> int:
    """Re-queue any request stuck in 'generating' (e.g. the watcher was
    restarted mid-generation). Only one watcher runs, so 'generating' on
    startup is always stale."""
    from google.cloud.firestore_v1.base_query import FieldFilter
    n = 0
    for d in db.collection("blogGenRequests").where(filter=FieldFilter("status", "==", "generating")).stream():
        d.reference.update({"status": "queued"})
        n += 1
    if n:
        print(f"re-queued {n} stale 'generating' request(s)")
    return n


def poll_once(db) -> int:
    from google.cloud.firestore_v1.base_query import FieldFilter
    docs = [d for d in db.collection("blogGenRequests").where(filter=FieldFilter("status", "==", "queued")).stream()]
    docs.sort(key=lambda d: d.to_dict().get("createdAt", ""))
    for d in docs:
        process(db, d)
    return len(docs)


# ── LinkedIn auth-outage handling ────────────────────────────────────────────
# LinkedIn issues this app a ~60-day access token and NO refresh token, so it
# WILL expire on a schedule only a human can reset (browser OAuth re-consent).
# The Aug 2026 outage: every publish 401'd for a week, each burned the post's
# 2 linkedinTries, and nothing alerted — silent failure on a delivery path.
# Now: probe the token BEFORE attempting posts; an auth outage pauses posting
# without consuming tries and pages Sai once (with the renewal command).
LI_PROBE_EVERY_S = int(os.environ.get("LINKEDIN_PROBE_EVERY_S", "900"))
LI_MIN_GAP_S = int(os.environ.get("LINKEDIN_AUTOPOST_MIN_GAP_S", "1800"))
_li_state = {"down": False, "alerted": False, "last_probe": 0.0,
             "probe_fails": 0, "last_post": 0.0}
_LI_AUTH_SIG = ("EXPIRED_ACCESS_TOKEN", "REVOKED_ACCESS_TOKEN",
                "INVALID_ACCESS_TOKEN", "invalid_grant", "HTTP 401",
                "no LinkedIn token")
_LI_RENEW_HINT = ("Renew: python3 scripts/linkedin_pipeline.py auth-url → open the "
                  "URL, authorize, then `exchange <code>`. Queued posts auto-post "
                  "once the token is back.")


def _li_auth_error(text: str) -> bool:
    return any(s in text for s in _LI_AUTH_SIG)


def _li_token_ok(queued: int) -> bool:
    """Preflight the LinkedIn token (whoami). During an outage, re-probe at most
    every LI_PROBE_EVERY_S. Alerts once per outage; recovery note on restore."""
    now = time.time()
    if _li_state["down"] and now - _li_state["last_probe"] < LI_PROBE_EVERY_S:
        return False
    _li_state["last_probe"] = now
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "linkedin_pipeline.py"), "whoami"],
                       cwd=str(ROOT), capture_output=True, text=True, timeout=90)
    if r.returncode == 0:
        if _li_state["down"]:
            _alert_telegram("✅ LinkedIn token is valid again — queued blog posts "
                            "will auto-post (one per "
                            f"{LI_MIN_GAP_S // 60} min).")
        _li_state.update(down=False, alerted=False, probe_fails=0)
        return True
    out = ((r.stderr or "") + (r.stdout or "")).strip()
    _li_state["down"] = True
    _li_state["probe_fails"] += 1
    print(f"  ⏸ linkedin preflight failed ({_li_state['probe_fails']}): {out[-300:]}")
    if not _li_state["alerted"]:
        if _li_auth_error(out):
            _alert_telegram(f"🔴 LinkedIn token expired/invalid — blog→LinkedIn "
                            f"auto-post PAUSED ({queued} post(s) queued, tries NOT "
                            f"burned). {_LI_RENEW_HINT}")
            _li_state["alerted"] = True
        elif _li_state["probe_fails"] >= 3:  # transient blips stay journal-only
            _alert_telegram(f"🔴 LinkedIn preflight failing "
                            f"({_li_state['probe_fails']} consecutive) — auto-post "
                            f"paused, {queued} post(s) queued. Last: {out[-200:]}")
            _li_state["alerted"] = True
    return False


def autopost_new_published(db) -> int:
    """Full-auto blog -> LinkedIn: post any PUBLISHED post that hasn't been
    posted yet. Dedup on linkedinPostId; give up after 2 failed tries so a
    post-specific failure doesn't retry forever — but an AUTH outage never
    consumes tries (preflight above). Backlog drains at most one post per
    LI_MIN_GAP_S so a renewal doesn't flood the feed. Pre-automation posts
    were marked handled, so only NEW publishes fire.
    Set LINKEDIN_AUTOPOST_DRY=1 to dry-run."""
    from google.cloud.firestore_v1.base_query import FieldFilter
    site = os.environ.get("SITE_BASE_URL", "https://saiteja.ai")
    dry = os.environ.get("LINKEDIN_AUTOPOST_DRY") == "1"
    cands = []
    for d in db.collection("blogPosts").where(filter=FieldFilter("published", "==", True)).stream():
        p = d.to_dict()
        if p.get("linkedinPostId") or (p.get("linkedinTries") or 0) >= 2:
            continue
        cands.append((d, p))
    if not cands:
        return 0
    if not dry and not _li_token_ok(len(cands)):
        return 0  # auth outage: nothing attempted, no tries consumed
    posted = 0
    for d, p in cands:
        if not dry and time.time() - _li_state["last_post"] < LI_MIN_GAP_S:
            break  # feed pacing: at most one auto-post per gap
        slug = p["slug"]
        tries = p.get("linkedinTries") or 0
        d.reference.update({"linkedinTries": tries + 1})
        cmd = [sys.executable, str(ROOT / "scripts" / "linkedin_pipeline.py"), "publish", slug]
        if not dry:
            cmd.append("--publish")
        print(f"→ linkedin {'(dry) ' if dry else ''}auto-post: {slug}")
        r = subprocess.run(cmd, cwd=str(ROOT), env={**os.environ, "SITE_BASE_URL": site},
                           capture_output=True, text=True, timeout=240)
        out = ((r.stderr or "") + (r.stdout or "")).strip()
        if r.returncode == 0 and (dry or "posted:" in r.stdout):
            print(f"  ✓ {'dry-ok' if dry else 'posted'}: {slug}")
            posted += 1
            _li_state["last_post"] = time.time()
        elif _li_auth_error(out):
            # Token died between preflight and publish: nothing was posted with
            # a dead token, so give the try back and stop until it's renewed.
            d.reference.update({"linkedinTries": tries})
            _li_state["down"] = True
            print(f"  ⏸ linkedin auth failed mid-flight, try refunded: {slug}")
            break
        else:
            d.reference.update({"linkedinLastError": out[-300:]})
            print(f"  ✗ linkedin failed {slug}: {out[-300:]}")
    return posted


# ── operator alerting: a persistently-failing watcher must not die silently ──
# One-off blips retry next tick (journal-only). A STREAK of failures means the
# pipeline is actually down (creds, Firestore, disk) and Sai would otherwise only
# find out when a blog post never appears. Alert once per streak, never spam.
ALERT_AFTER = int(os.environ.get("WATCHER_ALERT_AFTER", "5"))
_tg_cache: dict = {}


def _alert_telegram(text: str) -> None:
    """Best-effort one-shot Telegram alert via the SAME bot the pipeline uses
    (Secret Manager token, lazily fetched + cached). Never raises — alerting must
    not be able to kill the loop it reports on."""
    try:
        if "token" not in _tg_cache:
            def sec(name):
                r = subprocess.run(["gcloud", "secrets", "versions", "access", "latest",
                                    f"--secret={name}", f"--project={PROJECT}"],
                                   capture_output=True, text=True, timeout=25)
                return r.stdout.strip() if r.returncode == 0 else ""
            _tg_cache["token"] = sec("bloggersaibot-token")
            _tg_cache["chat"] = sec("bloggersaibot-chat-id")
        if not (_tg_cache["token"] and _tg_cache["chat"]):
            return
        body = json.dumps({"chat_id": int(_tg_cache["chat"]), "text": text}).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{_tg_cache['token']}/sendMessage",
            data=body, headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=15).read()
    except Exception as e:  # noqa: BLE001
        print(f"alert delivery failed: {e}")


def prune_gen(keep: int = int(os.environ.get("GEN_KEEP", "100"))) -> int:
    """Retention for .gen/ (one dir per generation, grows forever otherwise):
    keep the newest `keep`, delete the rest. Never raises."""
    try:
        if not GENDIR.exists():
            return 0
        dirs = sorted((d for d in GENDIR.iterdir() if d.is_dir()),
                      key=lambda d: d.stat().st_mtime, reverse=True)
        removed = 0
        for d in dirs[keep:]:
            subprocess.run(["rm", "-rf", str(d)], timeout=30)
            removed += 1
        return removed
    except Exception as e:  # noqa: BLE001
        print(f"gen prune skipped: {e}")
        return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--interval", type=int, default=30)
    args = ap.parse_args()
    db = _db()
    reset_stale(db)
    if args.once:
        n = poll_once(db)
        a = autopost_new_published(db)
        prune_gen()
        print(f"processed {n} request(s); auto-posted {a} to LinkedIn")
        return
    print(f"watching blogGenRequests + new publishes every {args.interval}s … (ctrl-c to stop)")
    streak = 0
    alerted = False
    ticks = 0
    while True:
        try:
            poll_once(db)
            autopost_new_published(db)
            if alerted:
                _alert_telegram("✅ Blog watcher recovered — polling normally again.")
            streak = 0
            alerted = False
        except Exception as e:
            streak += 1
            print(f"poll error ({streak} consecutive): {e}")
            if streak >= ALERT_AFTER and not alerted:
                _alert_telegram(
                    f"🔴 Blog watcher: {streak} consecutive poll failures "
                    f"(~{streak * args.interval}s) — pipeline is NOT processing "
                    f"requests. Last error: {str(e)[:200]}")
                alerted = True
        ticks += 1
        if ticks % 120 == 0:      # roughly hourly at the default interval
            prune_gen()
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
