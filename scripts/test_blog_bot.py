"""test_blog_bot.py — regression tests for blog_bot.py bug fixes:
  - Telegram Publish sets tgSynced=True so sync_published_elsewhere never overwrites it
  - Website-published sync records knowledge.publish_entry
  - Photo-fallback draft notifications record tgIsPhoto=False and _edit_status edits text
  - _edit_status falls back to editMessageText if editMessageCaption fails on legacy drafts
  - _research_card HTML-escapes URLs containing & or quotes
All pure / offline. Run: python3 scripts/run_tests.py
"""
import subprocess
import sys
import types
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def _load_blog_bot():
    if "blog_bot" in sys.modules:
        return sys.modules["blog_bot"]
    fake_run = lambda *a, **k: types.SimpleNamespace(returncode=0, stdout="12345", stderr="")
    with mock.patch.object(subprocess, "run", fake_run):
        import blog_bot
    return blog_bot


class _FakeDoc:
    def __init__(self, doc_id: str, data: dict, store: dict):
        self.id = doc_id
        self._store = store
        self._data = dict(data)
        self.exists = True
        self.reference = self

    def to_dict(self):
        return dict(self._data)

    def update(self, fields: dict):
        self._data.update(fields)
        self._store[self.id] = dict(self._data)

    def delete(self):
        self._store.pop(self.id, None)
        self.exists = False


class _MissingDoc:
    exists = False

    def to_dict(self):
        return None


class _FakeQuery:
    def __init__(self, store: dict, pred=None, cap=None):
        self._store = store
        self._pred = pred
        self._cap = cap

    def where(self, *args, filter=None):
        if filter is not None:
            field, op, val = filter.field_path, filter.op_string, filter.value
        else:
            field, op, val = args
        assert op == "=="
        prev = self._pred
        def p(d):
            return (prev(d) if prev else True) and d.get(field) == val
        return _FakeQuery(self._store, p, self._cap)

    def limit(self, n: int):
        return _FakeQuery(self._store, self._pred, n)

    def stream(self):
        out = []
        for k, v in list(self._store.items()):
            if self._pred is None or self._pred(v):
                out.append(_FakeDoc(k, v, self._store))
                if self._cap is not None and len(out) >= self._cap:
                    break
        return out


class _FakeCollection(_FakeQuery):
    def document(self, doc_id: str):
        store = self._store
        class _DocRef:
            def get(self_inner):
                if doc_id not in store:
                    return _MissingDoc()
                return _FakeDoc(doc_id, store[doc_id], store)
        return _DocRef()


class _FakeDB:
    def __init__(self, collections: dict):
        self._cols = collections

    def collection(self, name: str):
        return _FakeCollection(self._cols.setdefault(name, {}))


def test_telegram_publish_sets_tgSynced_and_sync_does_not_overwrite():
    bb = _load_blog_bot()
    bb._awaiting_sync.clear()
    bb._initial_sync_done = True
    slug = "demo-post"
    key = bb.tgkey(slug)
    db = _FakeDB({"blogPosts": {
        slug: {
            "slug": slug, "title": "Demo Post", "summary": "S", "tags": ["ai"],
            "sourceUrl": "https://example.com", "published": False,
            "generatedBy": "watcher", "tgNotified": True, "tgMessageId": 42,
            "tgKey": key, "tgIsPhoto": False,
        }
    }})
    bb._awaiting_sync.add(slug)
    calls = []

    def fake_tg(method, **kw):
        calls.append((method, kw))
        return {"ok": True, "result": {"message_id": 42}}

    with mock.patch.object(bb, "tg", fake_tg), \
            mock.patch.object(bb, "_now", lambda: "2026-11-21T14:00:00.000Z"), \
            mock.patch.object(bb, "knowledge", None):
        bb.handle_callback({"id": "cb1", "data": f"p:{key}"}, db)
        assert db._cols["blogPosts"][slug]["tgSynced"] is True
        edits_after_publish = [c for c in calls if c[0] == "editMessageText"]
        assert len(edits_after_publish) == 1
        assert "posting to LinkedIn shortly" in edits_after_publish[0][1]["text"]

        # Running sync_published_elsewhere must NOT overwrite the Telegram publish status.
        bb.sync_published_elsewhere(db)
        edits_after_sync = [c for c in calls if c[0] == "editMessageText"]
        assert len(edits_after_sync) == 1


def test_website_publish_sync_updates_card_and_records_knowledge():
    bb = _load_blog_bot()
    bb._awaiting_sync.clear()
    bb._initial_sync_done = True
    slug = "web-pub"
    db = _FakeDB({"blogPosts": {
        slug: {
            "slug": slug, "title": "Web Post", "summary": "Summary", "tags": ["llm"],
            "sourceUrl": "https://example.com/src", "published": True,
            "publishedAt": "2026-11-21T14:05:00.000Z",
            "tgNotified": True, "tgMessageId": 99, "tgIsPhoto": False,
        }
    }})
    bb._awaiting_sync.add(slug)
    calls = []
    pub_calls = []
    fake_k = types.SimpleNamespace(publish_entry=lambda *a: pub_calls.append(a))

    with mock.patch.object(bb, "tg", lambda m, **kw: calls.append((m, kw)) or {"ok": True}), \
            mock.patch.object(bb, "knowledge", fake_k):
        bb.sync_published_elsewhere(db)

    assert db._cols["blogPosts"][slug]["tgSynced"] is True
    assert any(m == "editMessageText" and "Published</b> from the website" in kw["text"] for m, kw in calls)
    assert len(pub_calls) == 1 and pub_calls[0][0] == slug
    assert slug not in bb._awaiting_sync


def test_photo_fallback_records_tgIsPhoto_false_and_edits_text():
    bb = _load_blog_bot()
    bb._awaiting_sync.clear()
    slug = "img-fallback"
    db = _FakeDB({"blogPosts": {
        slug: {
            "slug": slug, "title": "Fallback Post", "summary": "S",
            "heroImage": "https://example.com/broken.png",
            "published": False, "generatedBy": "watcher",
        }
    }})
    calls = []

    def fake_tg(method, **kw):
        calls.append((method, kw))
        if method == "sendPhoto":
            return {"ok": False, "error": "400 failed to get HTTP URL content"}
        if method == "sendMessage":
            return {"ok": True, "result": {"message_id": 77}}
        return {"ok": True}

    with mock.patch.object(bb, "tg", fake_tg):
        bb.notify_ready_drafts(db)
        post = db._cols["blogPosts"][slug]
        assert post["tgNotified"] is True and post["tgMessageId"] == 77
        assert post["tgIsPhoto"] is False

        calls.clear()
        bb._edit_status(77, post, "✅ <b>Published</b>")
        assert [m for m, _ in calls] == ["editMessageText", "editMessageReplyMarkup"]


def test_edit_status_falls_back_from_caption_to_text_on_legacy_draft():
    bb = _load_blog_bot()
    post = {"title": "Legacy", "heroImage": "https://example.com/x.png"}  # no tgIsPhoto key
    calls = []

    def fake_tg(method, **kw):
        calls.append(method)
        if method == "editMessageCaption":
            return {"ok": False, "error": "Bad Request: there is no caption in the message to edit"}
        return {"ok": True}

    with mock.patch.object(bb, "tg", fake_tg):
        bb._edit_status(55, post, "✅ <b>Published</b>")
    assert calls == ["editMessageCaption", "editMessageText", "editMessageReplyMarkup"]


def test_research_card_escapes_url_html_entities():
    bb = _load_blog_bot()
    card = bb._research_card({
        "kind": "announcement",
        "title": "Test",
        "url": 'https://example.com/post?a=1&b=2&c="quoted"',
        "verdict": {"whyItMatters": "Important", "importance": 8, "confidence": 8},
    })
    assert 'href="https://example.com/post?a=1&amp;b=2&amp;c=&quot;quoted&quot;"' in card
