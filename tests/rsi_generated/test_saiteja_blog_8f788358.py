import inspect
import os
import sys
import types
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import blog_watcher as bw  # noqa: E402

AUTH_ERR = "linkedin_pipeline: HTTP 401 EXPIRED_ACCESS_TOKEN"
NOW = 1_000_000.0


class FakeTime:
    def __init__(self):
        self.now = NOW

    def time(self):
        return self.now

    def sleep(self, _s):
        pass


class Proc:
    def __init__(self, rc=0, out="", err=""):
        self.returncode = rc
        self.stdout = out
        self.stderr = err


class Ref:
    def __init__(self, data):
        self.data = data

    def update(self, upd):
        self.data.update(upd)


class Doc:
    def __init__(self, data):
        self.data = data
        self.reference = Ref(data)

    def to_dict(self):
        return dict(self.data)


class Query:
    def __init__(self, docs):
        self.docs = docs

    def where(self, *a, **k):
        return self

    def stream(self):
        return iter(self.docs)


class FakeDB:
    def __init__(self, docs):
        self.docs = docs

    def collection(self, _name):
        return Query(self.docs)


def _stub_modules():
    base = types.ModuleType("google.cloud.firestore_v1.base_query")
    base.FieldFilter = lambda *a, **k: None
    v1 = types.ModuleType("google.cloud.firestore_v1")
    v1.base_query = base
    cloud = types.ModuleType("google.cloud")
    cloud.firestore_v1 = v1
    g = types.ModuleType("google")
    g.cloud = cloud
    return {"google": g, "google.cloud": cloud,
            "google.cloud.firestore_v1": v1,
            "google.cloud.firestore_v1.base_query": base}


def _proc_module():
    return next(m for m in vars(bw).values()
                if inspect.ismodule(m) and hasattr(m, "Popen") and hasattr(m, "run"))


class LinkedInOutageTest(unittest.TestCase):
    def setUp(self):
        if hasattr(bw, "_li_state"):
            bw._li_state.update(down=False, alerted=False, last_probe=0.0,
                                probe_fails=0, last_post=0.0)
        self.clock = FakeTime()
        self.alerts = []
        self.calls = []
        self.whoami = Proc(1, "", AUTH_ERR)
        self.publish = Proc(1, "", AUTH_ERR)
        self.posts = [Doc({"slug": "post-a", "published": True}),
                      Doc({"slug": "post-b", "published": True})]

        def fake_run(cmd, *a, **k):
            cmd = [str(c) for c in cmd]
            if "whoami" in cmd:
                self.calls.append("whoami")
                return self.whoami
            if "publish" in cmd:
                self.calls.append("publish:" + cmd[cmd.index("publish") + 1])
                return self.publish
            return Proc(0)

        patches = [
            mock.patch.dict(sys.modules, _stub_modules()),
            mock.patch.dict(os.environ, {}, clear=False),
            mock.patch.object(bw, "time", self.clock),
            mock.patch.object(bw, "_alert_telegram", self.alerts.append),
            mock.patch.object(_proc_module(), "run", fake_run),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        os.environ.pop("LINKEDIN_AUTOPOST_DRY", None)

    def publishes(self):
        return [c for c in self.calls if c.startswith("publish:")]

    def test_expired_token_pauses_without_burning_tries_and_pages_once(self):
        db = FakeDB(self.posts)
        n = bw.autopost_new_published(db)
        self.assertEqual(n, 0)
        self.assertEqual(self.publishes(), [])
        for d in self.posts:
            self.assertFalse(d.data.get("linkedinTries"))
        self.assertEqual(len(self.alerts), 1)
        # a second tick inside the probe window neither re-probes nor re-pages
        self.clock.now += 60
        bw.autopost_new_published(db)
        self.assertEqual(self.publishes(), [])
        self.assertEqual(len(self.alerts), 1)
        self.assertEqual(self.calls.count("whoami"), 1)

    def test_single_transient_preflight_failure_does_not_page_or_post(self):
        self.whoami = Proc(1, "", "connection reset by peer")
        bw.autopost_new_published(FakeDB(self.posts))
        self.assertEqual(self.publishes(), [])
        self.assertEqual(self.alerts, [])
        for d in self.posts:
            self.assertFalse(d.data.get("linkedinTries"))

    def test_midflight_auth_failure_refunds_try_and_stops_queue(self):
        self.whoami = Proc(0, "ok", "")
        n = bw.autopost_new_published(FakeDB(self.posts))
        self.assertEqual(n, 0)
        self.assertEqual(self.publishes(), ["publish:post-a"])
        self.assertEqual(self.posts[0].data.get("linkedinTries"), 0)
        self.assertFalse(self.posts[1].data.get("linkedinTries"))

    def test_backlog_drains_one_post_per_gap(self):
        self.whoami = Proc(0, "ok", "")
        self.publish = Proc(0, "posted: urn:li:share:1", "")
        db = FakeDB(self.posts)
        n = bw.autopost_new_published(db)
        self.assertEqual(n, 1)
        self.assertEqual(self.publishes(), ["publish:post-a"])
        self.clock.now += bw.LI_MIN_GAP_S + 1
        self.posts[0].data["linkedinPostId"] = "urn:li:share:1"
        n = bw.autopost_new_published(db)
        self.assertEqual(n, 1)
        self.assertEqual(self.publishes(), ["publish:post-a", "publish:post-b"])


if __name__ == "__main__":
    unittest.main()
