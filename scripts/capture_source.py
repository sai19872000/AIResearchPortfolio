#!/usr/bin/env python3
"""capture_source.py — headless-Chrome screenshot of a blog post's ORIGINAL
SOURCE page (the `sourceUrl` the post is about), used as the featured image
on both the blog post and LinkedIn image #1 (Sai: "I want it in both").

Usage:
  python3 scripts/capture_source.py <slug> <url>

Saves public/art/blog/<slug>-source.png, uploads it via gen_art.py's
upload_to_gcs, and prints `ART_URL: <url>` (same contract as gen_art.py).
Exits non-zero on any failure — timeout, chrome error, or a sanity check
that smells like a blank/cookie-wall frame — so callers must not treat a
non-zero exit as a success with a missing image.
"""
from __future__ import annotations
import struct, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_art import upload_to_gcs, PUBLIC  # reuse the same GCS uploader/bucket

CHROME = "/usr/bin/google-chrome"
TIMEOUT_S = 45
MIN_BYTES = 20_000


def _png_dimensions(png: Path) -> tuple[int, int] | None:
    """Parse the IHDR chunk directly (no deps) — width, height."""
    data = png.read_bytes()[:33]
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w, h = struct.unpack(">II", data[16:24])
    return w, h


def _distinct_colour_count(png: Path) -> int | None:
    """Cheap blank/solid-frame check via Pillow, if importable."""
    try:
        from PIL import Image
    except Exception:
        return None
    with Image.open(png) as im:
        im = im.convert("RGB")
        im.thumbnail((200, 200))  # downsample before sampling — cheap
        colours = im.getcolors(maxcolors=1_000_000)
    return len(colours) if colours is not None else None


def capture(slug: str, url: str) -> Path:
    out = PUBLIC / "art" / "blog" / f"{slug}-source.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    cmd = [CHROME, "--headless=new", f"--screenshot={out}",
           "--window-size=1280,1024", "--hide-scrollbars",
           "--virtual-time-budget=15000", url]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_S)
    if r.returncode != 0 or not out.exists():
        raise RuntimeError(f"chrome screenshot failed (exit {r.returncode}): {(r.stderr or '')[-400:]}")

    size = out.stat().st_size
    if size < MIN_BYTES:
        raise RuntimeError(f"screenshot too small ({size}B) — likely blank/cookie-wall frame")

    distinct = _distinct_colour_count(out)
    if distinct is not None:
        if distinct <= 2:
            raise RuntimeError(f"screenshot is a solid-colour frame ({distinct} distinct colour(s))")
    else:
        # Pillow unavailable: fall back to file-size + a real PNG header with
        # sane dimensions as the only sanity signal.
        dims = _png_dimensions(out)
        if not dims or dims[0] < 200 or dims[1] < 200:
            raise RuntimeError(f"screenshot has no valid/sane PNG dimensions: {dims}")
    return out


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: capture_source.py <slug> <url>")
        return 2
    slug, url = sys.argv[1], sys.argv[2]
    try:
        out = capture(slug, url)
    except Exception as e:
        print(f"FAILED: {e}")
        return 1
    art_url = upload_to_gcs(out)
    print(f"ART_URL: {art_url}" if art_url else f"ART_LOCAL: /{out.relative_to(PUBLIC).as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
