"""knowledge.py - the blog's tap into the home knowledge service.

A thin, stdlib-only, fail-open client. It (a) fetches a PUBLIC background block (and,
only when config `private_background` is true, a PRIVATE block the writer must not quote),
(b) detects when a draft copies private text (flag only, never refuses), and (c) writes ONE
public-scope entry after Sai's publish tap succeeded, with a durable spool and idempotent
retry. Config `~/.anywhere/blogger.json`, `enabled:false` by default and a complete off
switch. Nothing here may break the blog bot or the watcher: no public function raises.
"""
from __future__ import annotations

import contextlib
import fcntl
import hashlib
import http.client
import json
import os
import re
import socket
import stat
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

CONFIG_PATH = Path.home() / ".anywhere" / "blogger.json"   # tests rebind this
DEFAULTS = {"v": 1, "enabled": False, "private_background": False,
            "url": "http://127.0.0.1:8810",
            "token_file": str(Path.home() / ".anywhere/tokens/knowledge-blogger.token"),
            "timeout_read_s": 2.0, "timeout_write_s": 4.0,
            "spool": str(Path.home() / ".anywhere/blogger.spool.jsonl"), "overlap_words": 8}

_MAX_RESPONSE = 1048576
_SPOOL_CAP = 500
_SPOOL_MAX_AGE_S = 30 * 86400
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,110}$")
_TOKEN_RE = re.compile(r"^[A-Za-z0-9._~+/=-]{8,512}$")
_CODE_RE = re.compile(r"^[a-z0-9_]{1,40}$")
_URL_NETLOC_RE = re.compile(r"^127\.0\.0\.1(:\d{1,5})?$")
_WS_RE = re.compile(r"[\s\x00-\x1f\x7f  ]+")
PRIVATE_BEGIN = "<!--KNOWLEDGE-PRIVATE-BEGIN-->"
PRIVATE_END = "<!--KNOWLEDGE-PRIVATE-END-->"

_MEMO: dict = {"key": None, "cfg": None}
_WARNED: set = set()


class _TapError(Exception):
    """code: connect | timeout | too_large | bad_json | no_token | config"""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


# ---------------------------------------------------------------- logging
def _log(event: str, code: str = "", *, once: bool = False, key=None) -> None:
    try:
        if once:
            k = (key, event, code)
            if k in _WARNED:
                return
            _WARNED.add(k)
        print(f"knowledge-tap: {event}" + (f" {code}" if code else ""), file=sys.stderr)
    except Exception:
        pass


def _reset_for_tests() -> None:
    _MEMO["key"] = None
    _MEMO["cfg"] = None
    _WARNED.clear()


# ---------------------------------------------------------------- secure reads and config
def _read_secure(path, *, max_bytes: int) -> str | None:
    """Read a file we own, regular, not a symlink, no group/other access. None on any violation."""
    fd = None
    try:
        fd = os.open(str(path), os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0))
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != os.geteuid() or (st.st_mode & 0o077):
            return None
        chunks, total = [], 0
        while True:
            b = os.read(fd, 65536)
            if not b:
                break
            total += len(b)
            if total > max_bytes:
                return None
            chunks.append(b)
        return b"".join(chunks).decode("utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    finally:
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                pass


def _is_num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _valid_url(u) -> bool:
    try:
        if not isinstance(u, str):
            return False
        p = urlparse(u)
        if p.scheme != "http" or not _URL_NETLOC_RE.match(p.netloc or ""):
            return False
        if p.username is not None or p.password is not None or p.query or p.fragment or p.params:
            return False
        if p.path not in ("", "/"):
            return False
        port = p.port
        return port is None or 1 <= port <= 65535
    except Exception:
        return False


def _validate(raw) -> dict | None:
    if not isinstance(raw, dict) or not set(raw) <= set(DEFAULTS):
        return None
    cfg = dict(DEFAULTS)
    cfg.update(raw)
    if type(cfg["v"]) is not int or cfg["v"] != 1:
        return None
    if type(cfg["enabled"]) is not bool or type(cfg["private_background"]) is not bool:
        return None
    for k in ("timeout_read_s", "timeout_write_s"):
        if not _is_num(cfg[k]) or not (0.1 <= cfg[k] <= 30):
            return None
    ow = cfg["overlap_words"]
    if type(ow) is not int or not (1 <= ow <= 64):
        return None
    for k in ("url", "token_file", "spool"):
        if not isinstance(cfg[k], str) or not cfg[k]:
            return None
    for k in ("token_file", "spool"):
        if not os.path.isabs(cfg[k]) or "~" in cfg[k] or "\x00" in cfg[k]:
            return None
    if not _valid_url(cfg["url"]):
        return None
    return cfg


def load_config() -> dict | None:
    """Validated config merged over DEFAULTS; None when missing, invalid, disabled or unsafe."""
    try:
        path = CONFIG_PATH
        try:
            st = os.lstat(path)
        except OSError:
            return None
        key = (str(path), st.st_mtime_ns, st.st_size, st.st_mode)
        if _MEMO["key"] == key:
            return _MEMO["cfg"]
        cfg = None
        text = _read_secure(path, max_bytes=16384)
        if text is None:
            _log("config_unsafe", once=True, key=key)
        else:
            try:
                cfg = _validate(json.loads(text))
            except (ValueError, RecursionError):
                cfg = None
            if cfg is None:
                _log("config_invalid", once=True, key=key)
            elif not cfg["enabled"]:
                cfg = None
        _MEMO["key"], _MEMO["cfg"] = key, cfg
        return cfg
    except Exception:
        return None


def _read_token(cfg) -> str | None:
    try:
        path = cfg["token_file"]
        if not os.path.lexists(path):
            return None
        raw = _read_secure(path, max_bytes=1024)
        tok = raw.strip() if raw is not None else ""
        if not _TOKEN_RE.match(tok):
            _log("token_unsafe", once=True)
            return None
        return tok
    except Exception:
        return None


# ---------------------------------------------------------------- transport
def _post(cfg, route, body, *, timeout_s, headers=None) -> tuple[int, dict]:
    """POST json to the loopback service; wall-clock bounded by timeout_s. See spec 4.0."""
    token = _read_token(cfg)
    if token is None:
        raise _TapError("no_token")
    port = urlparse(cfg["url"]).port or 80
    payload = json.dumps(body, separators=(",", ":"), sort_keys=True).encode()
    hdrs = {"Content-Type": "application/json; charset=utf-8", "Connection": "close",
            "Authorization": "Bearer " + token}
    token = None
    hdrs.update(headers or {})
    deadline = time.monotonic() + timeout_s
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=timeout_s)
    holder: list = []
    fired: list = []

    def _cut():
        fired.append(1)
        try:
            if holder:
                holder[0].shutdown(socket.SHUT_RDWR)
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass

    timer = threading.Timer(timeout_s, _cut)
    timer.daemon = True
    timer.start()
    try:
        try:
            conn.connect()
        except OSError:
            raise _TapError("timeout" if fired else "connect")
        sock = conn.sock
        holder.append(sock)
        try:
            conn.request("POST", route, body=payload, headers=hdrs)
            resp = conn.getresponse()
            status = resp.status
            buf = bytearray()
            while True:
                if fired or time.monotonic() > deadline:
                    raise _TapError("timeout")
                if resp.isclosed():
                    break
                sock.settimeout(max(0.01, deadline - time.monotonic()))
                chunk = resp.read1(65536)
                if not chunk:
                    break
                buf += chunk
                if len(buf) > _MAX_RESPONSE:
                    raise _TapError("too_large")
        except _TapError:
            raise
        except (socket.timeout, TimeoutError):
            raise _TapError("timeout")
        except (OSError, http.client.HTTPException):
            raise _TapError("timeout" if fired or time.monotonic() > deadline else "connect")
        if fired or time.monotonic() > deadline:
            raise _TapError("timeout")
        try:
            parsed = json.loads(bytes(buf).decode("utf-8"))
        except (ValueError, UnicodeDecodeError, RecursionError):
            parsed = None
        if 200 <= status < 300:
            if not isinstance(parsed, dict):
                raise _TapError("bad_json")
            return status, parsed
        return status, parsed if isinstance(parsed, dict) else {}
    finally:
        timer.cancel()
        try:
            conn.close()
        except Exception:
            pass


def _clean(text, cap: int) -> str:
    """One line, no backticks, no control chars, no '<<<', no '<!--', capped."""
    if not isinstance(text, str):
        text = ""
    t = _WS_RE.sub(" ", text).replace("`", "")
    while "<<<" in t or "<!--" in t:
        t = t.replace("<<<", "<<").replace("<!--", "<-")
    return t.strip()[:cap]


# ---------------------------------------------------------------- recall
def _search_hits(cfg, query, limit, scope, timeout_s):
    """Raw hit list from one /v1/search call, or None on any failure."""
    try:
        status, body = _post(cfg, "/v1/search", {"query": query, "limit": limit, "scopes": [scope]},
                             timeout_s=timeout_s)
    except _TapError as e:
        _log("recall_failed", e.code, once=True)
        return None
    if status != 200:
        _log("recall_failed", f"http_{status}", once=True)
        return None
    hits = body.get("hits")
    if not isinstance(hits, list):
        _log("recall_failed", "shape", once=True)
        return None
    return hits


def _extract(hits, scope):
    """[(name, snippet)] for the hits this block may use; None when the service widened scope."""
    want = scope == "public"
    out, seen = [], set()
    for h in hits:
        if not isinstance(h, dict):
            continue
        sc = h.get("scope")
        if isinstance(sc, str) and sc != scope:
            _log("recall_failed", "scope_mismatch", once=True)
            return None
        if sc != scope or h.get("quotable") is not want:
            continue
        name, snip = _clean(h.get("name"), 80), _clean(h.get("snippet"), 240)
        if not name or not snip or (name, snip) in seen:
            continue
        seen.add((name, snip))
        out.append((name, snip))
    return out


def _cap_lines(lines: list[str], max_chars: int) -> str:
    if max_chars <= 0 or not lines:
        return ""
    out, total = [], 0
    for ln in lines:
        add = len(ln) + (1 if out else 0)
        if total + add > max_chars:
            break
        out.append(ln)
        total += add
    if not out:
        return lines[0][:max_chars]
    return "\n".join(out)


def _limit(limit) -> int:
    try:
        return max(1, min(50, int(limit)))
    except Exception:
        return 4


def recall_blocks_ex(query: str, *, limit: int = 4, max_chars: int = 2400) -> tuple[str, str, str]:
    empty = ("", "", "")
    try:
        cfg = load_config()
        if cfg is None or not isinstance(query, str) or not query.strip():
            return empty
        if _read_token(cfg) is None:
            return empty
        q, limit = _clean(query, 2000), _limit(limit)
        if not q:
            return empty
        t = float(cfg["timeout_read_s"])
        deadline = time.monotonic() + 2 * t
        pub = priv = corpus = ""
        hits = _search_hits(cfg, q, limit, "public", min(t, deadline - time.monotonic()))
        if hits is not None:
            rows = _extract(hits, "public")
            if rows:
                pub = _cap_lines([f"- {n}: {s}" for n, s in rows], max_chars)
        if cfg["private_background"] and deadline - time.monotonic() > 0:
            hits = _search_hits(cfg, q, limit, "personal", min(t, deadline - time.monotonic()))
            if hits is not None:
                rows = _extract(hits, "personal")
                if rows:
                    priv = _cap_lines([f"- {s}" for _, s in rows], max_chars)
                    corpus = _cap_lines([f"- {n}: {s}" for n, s in rows], max_chars)
        return pub, priv, corpus
    except Exception:
        return empty


def recall_blocks(query: str, *, limit: int = 4, max_chars: int = 2400) -> tuple[str, str]:
    pub, priv, _ = recall_blocks_ex(query, limit=limit, max_chars=max_chars)
    return pub, priv


def public_block(query: str, *, limit: int = 4, max_chars: int = 1600) -> str:
    try:
        cfg = load_config()
        if cfg is None or not isinstance(query, str) or not query.strip():
            return ""
        if _read_token(cfg) is None:
            return ""
        q = _clean(query, 2000)
        if not q:
            return ""
        hits = _search_hits(cfg, q, _limit(limit), "public", float(cfg["timeout_read_s"]))
        if hits is None:
            return ""
        rows = _extract(hits, "public")
        return _cap_lines([f"- {n}: {s}" for n, s in rows], max_chars) if rows else ""
    except Exception:
        return ""


# ---------------------------------------------------------------- overlap
_TOK_RE = re.compile(r"[a-z0-9]+")
_NUM_RE = re.compile(r"[0-9][0-9.,]{3,}")
_CAP_RE = re.compile(r"[A-Z][A-Za-z0-9]{3,}")


def _corpus_parts(corpus: str):
    """Yield (name_or_None, snippet) per corpus line."""
    for line in corpus.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("- "):
            body = line[2:]
            if ": " in body:
                name, snip = body.split(": ", 1)
                yield name, snip
            else:
                yield None, body
        else:
            yield None, line


def overlap(post_texts: list[str], private_block: str, *, n: int = 8) -> int:
    """Count signals that a draft copies private text: shingles, entity names, distinctive tokens."""
    try:
        if not isinstance(private_block, str) or not private_block.strip():
            return 0
        texts = [t for t in (post_texts or []) if isinstance(t, str)]
        if not texts:
            return 0
        n = n if isinstance(n, int) and not isinstance(n, bool) and n >= 1 else 1
        post_toks = [_TOK_RE.findall(t.lower()) for t in texts]
        parts = list(_corpus_parts(private_block))

        # 1. shingles
        post_sh: set = set()
        for toks in post_toks:
            if len(toks) >= n:
                post_sh.update(zip(*(toks[i:] for i in range(n))))
        hit_sh: set = set()
        if post_sh:
            for _, snip in parts:
                toks = _TOK_RE.findall(snip.lower())
                if len(toks) >= n:
                    for sh in zip(*(toks[i:] for i in range(n))):
                        if sh in post_sh:
                            hit_sh.add(sh)
        total = len(hit_sh)

        # 2. entity names as whole-word phrases
        streams = [" " + " ".join(toks) + " " for toks in post_toks]
        names = set()
        for name, _ in parts:
            if name is None:
                continue
            phrase = " ".join(_TOK_RE.findall(name.lower()))
            if len(phrase) >= 4:
                names.add(phrase)
        for phrase in names:
            needle = " " + phrase + " "
            if any(needle in s for s in streams):
                total += 1

        # 3. distinctive tokens
        post_vocab: set = set()
        for t, toks in zip(texts, post_toks):
            post_vocab.update(toks)
            post_vocab.update(m.rstrip(".,") for m in _NUM_RE.findall(t.lower()))
        distinct: set = set()
        for _, snip in parts:
            for m in re.finditer(r"[A-Za-z0-9]+", snip):
                tok = m.group(0)
                if _CAP_RE.fullmatch(tok) and snip[max(0, m.start() - 2):m.start()] not in (". ", "! ", "? ") \
                        and m.start() != 0:
                    distinct.add(tok.lower())
            for m in _NUM_RE.findall(snip):
                distinct.add(m.lower().rstrip(".,"))
        total += sum(1 for d in distinct if d in post_vocab)
        return total
    except Exception:
        return -1


# ---------------------------------------------------------------- envelope, classify
def idempotency_key(slug) -> str:
    return "blog-" + hashlib.sha256(str(slug).encode()).hexdigest()[:32]


def build_envelope(slug, title, summary, tags, source_url) -> dict | None:
    if not isinstance(slug, str) or not _SLUG_RE.match(slug):
        return None
    t = _clean(title, 200).rstrip(".")
    s = _clean(summary, 600).rstrip(".")
    tg = []
    for x in (tags if isinstance(tags, (list, tuple)) else []):
        c = _clean(x, 40).rstrip(".")
        if c:
            tg.append(c)
    tg = tg[:8]
    u = _clean(source_url, 300)
    pieces = ([t + "."] if t else []) + ([s + "."] if s else []) \
        + (["Tags: " + ", ".join(tg) + "."] if tg else []) + ([u] if u else [])
    obs = " ".join(pieces)
    if not obs:
        return None
    return {"v": 1, "op": "remember", "via": "blog-bot",
            "args": {"entity": "blog:" + slug, "entity_type": "artifact", "observation": obs,
                     "scope": "public", "source": "blog:published",
                     "source_ref": {"type": "blog", "id": slug}, "confidence": 1.0}}


def _classify(status: int, body: dict) -> str:
    if status == 200 and isinstance(body, dict) and body.get("state") == "applied":
        return "ok"
    if 300 <= status < 400 or status in (408, 429, 401, 403) or status >= 500:
        return "transient"
    return "refused"


def _refusal_code(status: int, body: dict) -> str:
    c = None
    if isinstance(body, dict):
        if status == 200:
            c = body.get("state") or body.get("code")
        elif not (200 <= status < 300):
            e = body.get("error")
            c = e.get("code") if isinstance(e, dict) else None
    return c if isinstance(c, str) and _CODE_RE.match(c) else "-"


def _attempt(cfg, slug: str, env: dict) -> str:
    """One write. 'ok' | 'transient' | 'refused' (logged)."""
    try:
        status, body = _post(cfg, "/v1/write", env, timeout_s=float(cfg["timeout_write_s"]),
                             headers={"Idempotency-Key": idempotency_key(slug)})
    except _TapError as e:
        _log("write_failed", e.code, once=True)
        return "transient"
    verdict = _classify(status, body)
    if verdict == "refused":
        _log("write_refused", f"{status} {_refusal_code(status, body)}")
    elif verdict == "transient":
        _log("write_failed", f"http_{status}", once=True)
    return verdict


# ---------------------------------------------------------------- spool
@contextlib.contextmanager
def _locked(spool_path):
    fd = None
    got = False
    try:
        d = os.path.dirname(str(spool_path)) or "."
        if not os.path.isdir(d):
            os.makedirs(d, mode=0o700, exist_ok=True)
        fd = os.open(str(spool_path) + ".lock", os.O_RDWR | os.O_CREAT, 0o600)
        end = time.monotonic() + 2.0
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                got = True
                break
            except OSError:
                if time.monotonic() >= end:
                    break
                time.sleep(0.05)
    except OSError:
        got = False
    try:
        yield got
    finally:
        if fd is not None:
            try:
                if got:
                    fcntl.flock(fd, fcntl.LOCK_UN)
                os.close(fd)
            except OSError:
                pass


def _read_lines(path) -> list[str] | None:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return [ln for ln in f.read().split("\n") if ln.strip()]
    except FileNotFoundError:
        return []
    except OSError:
        return None


def _write_lines(path, lines: list[str]) -> None:
    tmp = str(path) + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.fchmod(fd, 0o600)
        data = ("\n".join(lines) + "\n") if lines else ""
        os.write(fd, data.encode("utf-8"))
    finally:
        os.close(fd)
    os.replace(tmp, str(path))


def _parse(line: str):
    try:
        d = json.loads(line)
    except (ValueError, RecursionError):
        return None
    if not isinstance(d, dict) or not isinstance(d.get("slug"), str) or not _SLUG_RE.match(d["slug"]):
        return None
    return d


def _entry_ok(d, now: float) -> bool:
    if d is None:
        return False
    q = d.get("queued_at")
    if not _is_num(q) or now - q > _SPOOL_MAX_AGE_S:
        return False
    return build_envelope(d["slug"], d.get("title"), d.get("summary"), d.get("tags"), d.get("source_url")) is not None


def _spool_add(cfg, entry: dict) -> None:
    path = cfg["spool"]
    try:
        with _locked(path) as got:
            if not got:
                _log("spool_failed", "lock")
                return
            lines = _read_lines(path)
            if lines is None:
                _log("spool_failed", "read")
                return
            for ln in lines:
                d = _parse(ln)
                if d is not None and d["slug"] == entry["slug"]:
                    return
            lines.append(json.dumps(entry, separators=(",", ":"), sort_keys=True))
            while len(lines) > _SPOOL_CAP:
                lines.pop(0)
                _log("spool_full")
            _write_lines(path, lines)
            _log("spooled")
    except Exception:
        _log("spool_failed", "io")


def publish_entry(slug, title, summary, tags, source_url, published_at) -> bool:
    try:
        cfg = load_config()
        if cfg is None:
            return False
        env = build_envelope(slug, title, summary, tags, source_url)
        if env is None or _read_token(cfg) is None:
            return False
        verdict = _attempt(cfg, slug, env)
        if verdict == "ok":
            return True
        if verdict == "transient":
            _spool_add(cfg, {
                "slug": slug, "title": title if isinstance(title, str) else "",
                "summary": summary if isinstance(summary, str) else None,
                "tags": [x for x in (tags or []) if isinstance(x, str)] if isinstance(tags, (list, tuple)) else [],
                "source_url": source_url if isinstance(source_url, str) else "",
                "published_at": published_at if isinstance(published_at, str) else ("" if published_at is None else str(published_at)),
                "queued_at": time.time(), "attempts": 0})
        return False
    except Exception:
        return False


def flush_spool(max_items: int = 20) -> int:
    try:
        cfg = load_config()
        if cfg is None:
            return 0
        path = cfg["spool"]
        if not os.path.exists(path):
            return 0
        if _read_token(cfg) is None:
            return 0
        now = time.time()
        # phase 1: read under the lock
        with _locked(path) as got:
            if not got:
                _log("spool_failed", "lock")
                return 0
            lines = _read_lines(path)
        if lines is None:
            return 0
        work = []
        for ln in lines:
            d = _parse(ln)
            if _entry_ok(d, now) and len(work) < max(0, int(max_items)):
                work.append(d)
        # phase 2: network, no lock
        written, removed, failed = [], [], None
        for d in work:
            env = build_envelope(d["slug"], d.get("title"), d.get("summary"), d.get("tags"), d.get("source_url"))
            v = _attempt(cfg, d["slug"], env)
            if v == "ok":
                written.append(d["slug"])
            elif v == "refused":
                removed.append(d["slug"])
            else:
                failed = d["slug"]
                break
        # phase 3: rewrite under the lock from a fresh read
        drop = set(written) | set(removed)
        with _locked(path) as got:
            if not got:
                return len(written)
            lines = _read_lines(path)
            if lines is None:
                return len(written)
            out, changed, torn = [], False, False
            for ln in lines:
                d = _parse(ln)
                if not _entry_ok(d, now):
                    changed = torn = True
                    continue
                if d["slug"] in drop:
                    changed = True
                    continue
                if d["slug"] == failed:
                    d["attempts"] = (d.get("attempts") if _is_num(d.get("attempts")) else 0) + 1
                    out.append(json.dumps(d, separators=(",", ":"), sort_keys=True))
                    changed = True
                    continue
                out.append(ln)
            if torn:
                _log("spool_torn")
            if changed:
                try:
                    _write_lines(path, out)
                except OSError:
                    _log("spool_failed", "io")
        if written:
            _log("flush", str(len(written)))
        return len(written)
    except Exception:
        return 0


# ---------------------------------------------------------------- private text hand-off
def read_private(workdir: Path) -> str:
    try:
        t = _read_secure(Path(workdir) / "private_background.txt", max_bytes=_MAX_RESPONSE)
        return t or ""
    except Exception:
        return ""


def scrub_private(workdir: Path) -> None:
    try:
        wd = Path(workdir)
        try:
            (wd / "private_background.txt").unlink()
        except OSError:
            pass
        brief = wd / "brief.md"
        try:
            text = brief.read_text()
        except OSError:
            return
        b = text.rfind(PRIVATE_BEGIN)
        if b < 0:
            return
        e = text.find(PRIVATE_END, b)
        if e < 0:
            return
        new = text[:b] + "## Private background\n\n(removed after generation)\n" + text[e + len(PRIVATE_END):]
        brief.write_text(new)
    except Exception:
        pass
