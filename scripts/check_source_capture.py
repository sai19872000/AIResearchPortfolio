"""check_source_capture.py — live regression check for source-screenshot capture.

capture_source.py once produced 1-3 KB blank/consent-wall PNGs for several publishers and the
post shipped with a useless "source" image. This captures a fixed set of representative URLs and
requires every PNG to be > 50 KB. NETWORK + chromium: run on the host, NOT in CI.

Run: python3 scripts/check_source_capture.py        (exit 1 if any capture is too small)
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import capture_source as cs  # noqa: E402

MIN_BYTES = 50 * 1024
URLS = [
    "https://openai.com/news/",
    "https://deepmind.google/discover/blog/",
    "https://huggingface.co/blog",
    "https://share.google/",  # redirect host
    "https://www.businessinsider.com/",
]


def main() -> int:
    bad = 0
    for i, url in enumerate(URLS):
        try:
            p = cs.capture(f"check-{i}", url)
            n = Path(p).stat().st_size
            ok = n > MIN_BYTES
        except Exception as e:  # noqa: BLE001
            n, ok = 0, False
            print(f"  error: {e}")
        print(f"{'ok  ' if ok else 'FAIL'} {n:>8} B  {url}")
        bad += (not ok)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
