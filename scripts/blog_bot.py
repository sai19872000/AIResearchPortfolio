#!/usr/bin/env python3
"""blog_bot.py — @Bloggersaibot, a Telegram front-end to the saiteja.ai blog
pipeline. Long-polls Telegram; shares Firestore (the queue + posts) with the
website /admin and the watcher.

Flow: DM an idea (+ URLs / PDFs) -> a blogGenRequest in the same queue -> the
watcher writes the draft -> the bot DMs you the draft (infographic + caption +
preview link) with Publish / Reject -> Publish marks it published (blog live +
the watcher auto-posts LinkedIn). Approving in the website keeps the bot in sync.

Locked to one chat id. Token + chat id + the preview HMAC secret come from
Secret Manager. Run as a local systemd --user service.
"""
from __future__ import annotations
import hashlib, hmac, html, json, os, re, subprocess, sys, time, urllib.parse, urllib.request
from pathlib import Path

os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
PROJECT = os.environ.get("FIRESTORE_PROJECT_ID", "auracle-prod-311")
DATABASE = os.environ.get("FIRESTORE_DATABASE_ID", "saiteja-site")
ROOT = Path(__file__).resolve().parent.parent
SITE = os.environ.get("SITE_BASE_URL", "https://saiteja.ai")
URL_RE = re.compile(r"https?://[^\s)>\]]+")


def _secret(name: str) -> str:
    r = subprocess.run(["gcloud", "secrets", "versions", "access", "latest",
                        f"--secret={name}", f"--project={PROJECT}"],
                       capture_output=True, text=True, timeout=25)
    if r.returncode != 0 or not r.stdout.strip():
        sys.exit(f"missing Secret Manager secret '{name}'")
    return r.stdout.strip()


TOKEN = _secret("bloggersaibot-token")
CHAT_ID = int(_secret("bloggersaibot-chat-id"))
PREVIEW_SECRET = _secret("saiteja-admin-session-secret")
TG = f"https://api.telegram.org/bot{TOKEN}"


def _db():
    from google.cloud import firestore
    return firestore.Client(project=PROJECT, database=DATABASE)


# ---- Telegram API -------------------------------------------------------
def tg(method: str, **params):
    data = json.dumps(params).encode()
    req = urllib.request.Request(f"{TG}/{method}", data=data,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=70) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": e.read().decode("utf-8", "ignore")[:200]}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


def send(text: str, **kw):
    return tg("sendMessage", chat_id=CHAT_ID, text=text, parse_mode="HTML",
              disable_web_page_preview=True, **kw)


def kbd(slug: str):
    k = tgkey(slug)
    return {"inline_keyboard": [[{"text": "✅ Publish", "callback_data": f"p:{k}"},
                                 {"text": "🗑 Reject", "callback_data": f"r:{k}"}]]}


def tgkey(slug: str) -> str:
    return hashlib.sha1(slug.encode()).hexdigest()[:12]


def preview_url(slug: str) -> str:
    tok = hmac.new(PREVIEW_SECRET.encode(), slug.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{SITE}/preview/{slug}?t={tok}"


def _now() -> str:
    return subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%S.000Z"], capture_output=True, text=True).stdout.strip()


# ---- intake -------------------------------------------------------------
def create_request(topic: str, urls=None, refs=None) -> str:
    now = _now()
    ref = _db().collection("blogGenRequests").add({
        "topic": topic.strip(), "angle": None,
        "referenceUrls": urls or [], "references": refs or [], "options": {},
        "status": "queued", "error": None, "resultSlug": None,
        "createdAt": now, "updatedAt": now, "source": "telegram",
    })
    return ref[1].id


def extract_pdf_text(file_bytes: bytes) -> str:
    try:
        import io, pypdf
        rd = pypdf.PdfReader(io.BytesIO(file_bytes))
        return "\n".join((p.extract_text() or "") for p in rd.pages)[:60000]
    except Exception as e:
        return f"[could not read pdf: {e}]"


def handle_document(msg: dict):
    doc = msg["document"]
    name = doc.get("file_name", "upload.pdf")
    if not (doc.get("mime_type", "").endswith("pdf") or name.lower().endswith(".pdf")):
        send("I can read PDF references for now. Send a PDF, or just type the idea.")
        return
    fi = tg("getFile", file_id=doc["file_id"])
    path = (fi.get("result") or {}).get("file_path")
    if not path:
        send("Couldn't fetch that file, sorry. Try again?")
        return
    with urllib.request.urlopen(f"https://api.telegram.org/file/bot{TOKEN}/{path}", timeout=60) as r:
        data = r.read()
    text = extract_pdf_text(data)
    topic = (msg.get("caption") or f"A post drawing on the attached document: {name}").strip()
    rid = create_request(topic, urls=URL_RE.findall(msg.get("caption", "")),
                         refs=[{"title": name, "url": None, "text": text}])
    send(f"📥 Queued — writing a draft from <b>{html.escape(name)}</b>. I'll send it for approval when it's ready.")


def handle_message(msg: dict):
    text = (msg.get("text") or "").strip()
    if msg.get("document"):
        return handle_document(msg)
    if not text:
        return
    # A reply to a draft/published card = "rewrite this caption", not a new idea.
    reply = msg.get("reply_to_message")
    if reply and not text.startswith("/") and handle_caption_edit(reply, text):
        return
    if text.startswith("/start"):
        send("👋 This is your blog desk. Send me an <b>idea</b> (a sentence, or with links / a PDF) and "
             "I'll write a draft, then send it back here with a <b>Publish</b> / <b>Reject</b> choice. "
             "Publishing posts it to the blog and LinkedIn.\n\n"
             "To change a caption, <b>reply</b> to a draft (or published) card with the new wording — "
             "before publishing it updates the draft; after, it edits the live LinkedIn post.\n\n"
             "Commands: /queue  ·  /help")
        return
    if text.startswith("/help"):
        send("Send an idea (optionally with URLs or a PDF) → I queue a draft → you get it here to "
             "Publish or Reject. Same queue as the website. /queue shows what's in flight.\n\n"
             "Reply to any draft/published card with new text to rewrite its caption "
             "(edits the live LinkedIn post once it's published).")
        return
    if text.startswith("/queue"):
        return cmd_queue()
    # a plain idea
    urls = URL_RE.findall(text)
    rid = create_request(text, urls=urls)
    extra = f" ({len(urls)} link{'s' if len(urls) != 1 else ''} as references)" if urls else ""
    send(f"📥 Queued{extra} — I'll send the draft for approval when it's ready.")


def cmd_queue():
    db = _db()
    reqs = [d.to_dict() for d in db.collection("blogGenRequests").stream()]
    pending = [r for r in reqs if r.get("status") in ("queued", "generating")]
    drafts = [d.to_dict() for d in db.collection("blogPosts").stream()
              if not d.to_dict().get("published") and d.to_dict().get("generatedBy") == "watcher"]
    lines = ["<b>Queue</b>"]
    if pending:
        lines += [f"• {html.escape(r['topic'][:50])} — <i>{r['status']}</i>" for r in pending[:8]]
    else:
        lines.append("• (nothing generating)")
    lines.append(f"\n<b>Drafts awaiting you</b>: {len(drafts)}")
    lines += [f"• {html.escape(d['title'][:55])}" for d in drafts[:8]]
    send("\n".join(lines))


# ---- approval notifications + callbacks ---------------------------------
def _draft_image(post: dict) -> str | None:
    m = re.search(r"!\[[^\]]*\]\((https?://[^)\s]+)\)", post.get("content") or "")
    return m.group(1) or post.get("heroImage")


def _draft_card(p: dict) -> str:
    """Approval-card text. Field caps keep the photo-CAPTION form safely under
    Telegram's 1024-char limit *with the trailing <a> tag intact* — slicing a
    long caption mid-tag makes Telegram reject the whole HTML caption (that
    silently dropped a draft once: long post → 1079-char caption → 400)."""
    cap = (p.get("linkedinPost") or p.get("summary") or "").strip()
    return (f"📝 <b>{html.escape(p['title'][:140])}</b>\n\n"
            f"{html.escape((p.get('summary') or '')[:200])}\n\n"
            f"<i>LinkedIn caption:</i>\n{html.escape(cap[:360])}\n\n"
            f"📖 <a href=\"{preview_url(p['slug'])}\">read the full draft</a>\n"
            "↩️ reply to this message to rewrite the caption")


def notify_ready_drafts(db):
    for d in db.collection("blogPosts").stream():
        p = d.to_dict()
        if p.get("published") or p.get("generatedBy") != "watcher" or p.get("tgNotified"):
            continue
        slug = p["slug"]
        body = _draft_card(p)
        img = _draft_image(p)
        res = (tg("sendPhoto", chat_id=CHAT_ID, photo=img, caption=body,
                  parse_mode="HTML", reply_markup=kbd(slug)) if img else None)
        mid = (res.get("result") or {}).get("message_id") if res else None
        if mid is None:
            # No image, or the photo send failed (caption/limits, bad image URL).
            # Fall back to a plain-text card — 4096-char limit, no remote fetch.
            res = send(body, reply_markup=kbd(slug))
            mid = (res.get("result") or {}).get("message_id")
        if mid is None:
            # Still undelivered — leave tgNotified UNSET so the next loop retries
            # instead of silently marking it done (the old bug).
            print(f"notify FAILED {slug}: {res}")
            continue
        d.reference.update({"tgNotified": True, "tgMessageId": mid, "tgKey": tgkey(slug)})
        print(f"notified draft: {slug}")


def _find_by_key(db, key: str):
    for d in db.collection("blogPosts").stream():
        if d.to_dict().get("tgKey") == key:
            return d
    return None


def _find_by_message_id(db, mid):
    for d in db.collection("blogPosts").stream():
        if d.to_dict().get("tgMessageId") == mid:
            return d
    return None


def handle_caption_edit(reply: dict, new_text: str) -> bool:
    """A text reply to a draft/published card means "rewrite this caption".
    If the post is already on LinkedIn, edit the live post; if it's still a
    draft, update the caption the watcher will post. Returns True when the
    reply matched a known post (so it shouldn't be treated as a new idea)."""
    db = _db()
    doc = _find_by_message_id(db, reply.get("message_id"))
    if not doc:
        return False
    p = doc.to_dict()
    slug = p["slug"]
    if p.get("linkedinPostId"):
        r = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "linkedin_pipeline.py"),
             "edit", slug, new_text],
            cwd=str(ROOT), env={**os.environ, "SITE_BASE_URL": SITE},
            capture_output=True, text=True, timeout=120)
        if r.returncode == 0 and "edited:" in r.stdout:
            send(f"✏️ Caption updated on LinkedIn — <b>{html.escape(p['title'])}</b>.")
        else:
            send("⚠️ Couldn't edit the LinkedIn caption.\n"
                 f"<code>{html.escape((r.stderr or r.stdout)[-250:])}</code>")
    else:
        link = f"{SITE}/blog/{slug}"
        capped = new_text if "/blog/" in new_text else f"{new_text}\n\n{link}"
        doc.reference.update({"linkedinPost": capped, "updatedAt": _now()})
        send(f"✏️ Caption updated for <b>{html.escape(p['title'])}</b> — "
             "I'll use it when this is posted to LinkedIn.")
    return True


def handle_callback(cb: dict, db):
    data = cb.get("data", "")
    cid = cb["id"]
    action, _, key = data.partition(":")
    doc = _find_by_key(db, key)
    if not doc:
        tg("answerCallbackQuery", callback_query_id=cid, text="post not found")
        return
    p = doc.to_dict()
    mid = p.get("tgMessageId")
    if action == "p":
        if p.get("published"):
            tg("answerCallbackQuery", callback_query_id=cid, text="already published")
        else:
            doc.reference.update({"published": True, "publishedAt": _now(), "updatedAt": _now()})
            tg("answerCallbackQuery", callback_query_id=cid, text="published ✓")
            _edit_status(mid, p, "✅ <b>Published</b> — posting to LinkedIn shortly.")
    elif action == "r":
        doc.reference.delete()
        tg("answerCallbackQuery", callback_query_id=cid, text="rejected")
        _edit_status(mid, p, "🗑 <b>Rejected</b> — draft discarded.")


def _edit_status(mid, post, status_html: str):
    if not mid:
        return
    # photo messages: edit the caption; text messages: edit text
    img = _draft_image(post)
    base = f"📝 <b>{html.escape(post['title'])}</b>\n\n{status_html}"
    if img:
        tg("editMessageCaption", chat_id=CHAT_ID, message_id=mid, caption=base, parse_mode="HTML")
    else:
        tg("editMessageText", chat_id=CHAT_ID, message_id=mid, text=base, parse_mode="HTML")
    tg("editMessageReplyMarkup", chat_id=CHAT_ID, message_id=mid, reply_markup={"inline_keyboard": []})


def sync_published_elsewhere(db):
    """If a notified draft was published/deleted via the website, reflect it."""
    for d in db.collection("blogPosts").stream():
        p = d.to_dict()
        if p.get("tgNotified") and p.get("tgMessageId") and p.get("published") and not p.get("tgSynced"):
            _edit_status(p["tgMessageId"], p, "✅ <b>Published</b> from the website.")
            d.reference.update({"tgSynced": True})


# ---- offset persistence + main loop -------------------------------------
def _offset_doc(db):
    return db.collection("_botState").document("bloggersaibot")


def main():
    db = _db()
    od = _offset_doc(db)
    snap = od.get()
    offset = (snap.to_dict() or {}).get("offset", 0) if snap.exists else 0
    print(f"@Bloggersaibot up. chat={CHAT_ID}, offset={offset}")
    while True:
        try:
            r = tg("getUpdates", offset=offset, timeout=50, allowed_updates=["message", "callback_query"])
            for upd in r.get("result", []):
                offset = upd["update_id"] + 1
                if "callback_query" in upd:
                    cq = upd["callback_query"]
                    if cq.get("from", {}).get("id") == CHAT_ID:
                        handle_callback(cq, db)
                    else:
                        tg("answerCallbackQuery", callback_query_id=cq["id"], text="not authorized")
                    continue
                msg = upd.get("message") or {}
                if msg.get("chat", {}).get("id") != CHAT_ID:
                    continue  # locked to one chat
                handle_message(msg)
            od.set({"offset": offset})
            notify_ready_drafts(db)
            sync_published_elsewhere(db)
        except Exception as e:
            print(f"loop error: {e}")
            time.sleep(5)


if __name__ == "__main__":
    main()
