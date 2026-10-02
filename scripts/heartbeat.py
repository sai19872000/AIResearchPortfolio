"""heartbeat.py — tiny, never-raising liveness/functional-state files.

`systemctl is-active` says the process exists; it cannot say the watcher is
actually polling, that LinkedIn has been paused for two days, or that the scout
ran but recommended nothing. These JSON files can. Consumers (the factory's
apphealer) read them and compare `written_at` against a max age.

Default dir: ~/.auracle/products/saiteja-blog (override: SAITEJA_HEARTBEAT_DIR).
Writes are atomic (tmp + rename) and merge into the existing file. Any failure
is swallowed: a heartbeat problem must never be able to stop the pipeline.
"""
from __future__ import annotations
import json, os, tempfile
from datetime import datetime, timezone
from pathlib import Path

WATCHER_FILE = "heartbeat.json"
SCOUT_FILE = "heartbeat-scout.json"


def heartbeat_dir() -> Path:
    return Path(os.environ.get("SAITEJA_HEARTBEAT_DIR")
                or Path.home() / ".auracle" / "products" / "saiteja-blog")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write(filename: str, fields: dict, merge: bool = True) -> bool:
    """Write/merge `fields` (+ written_at, pid) atomically. Returns success."""
    try:
        d = heartbeat_dir()
        d.mkdir(parents=True, exist_ok=True)
        path = d / filename
        data: dict = {}
        if merge and path.exists():
            try:
                data = json.loads(path.read_text())
            except Exception:  # noqa: BLE001 — corrupt file: start over
                data = {}
        data.update(fields)
        data["written_at"] = now_iso()
        data["pid"] = os.getpid()
        fd, tmp = tempfile.mkstemp(dir=str(d), prefix=filename + ".")
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=1, sort_keys=True)
        os.replace(tmp, path)
        return True
    except Exception as e:  # noqa: BLE001
        print(f"heartbeat write skipped: {e}")
        return False


def age_seconds(iso: str | None, now: datetime | None = None) -> int | None:
    """Seconds since an ISO-8601 timestamp (Z or +00:00); None if unparsable."""
    if not iso:
        return None
    try:
        t = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return max(0, int(((now or datetime.now(timezone.utc)) - t).total_seconds()))
    except Exception:  # noqa: BLE001
        return None
