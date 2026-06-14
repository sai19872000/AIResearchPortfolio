#!/usr/bin/env python3
"""Generate on-brand (Aura) art for saiteja.ai via nano-banana (Gemini 3 Pro
Image) through Auracle's genimage CLI — no API cost, runs on the Ultra sub.

Bakes the Aura palette + "quietly forged" restraint into every prompt so art
stays on-brand. Outputs PNGs into public/art/ (bundled with the site, never
hotlinked).

Usage:
  python3 scripts/gen_art.py og
  python3 scripts/gen_art.py hero <slug> "<concept of the post>"
  python3 scripts/gen_art.py infographic <slug> "<what the diagram should show>"

Requires: /home/sai/auracle/bin/genimage on disk (the agy/Ultra renderer).
"""
from __future__ import annotations
import os, subprocess, sys
from pathlib import Path

GENIMAGE = "/home/sai/auracle/bin/genimage"
PUBLIC = Path(__file__).resolve().parent.parent / "public"
ART_DIR = PUBLIC / "art"
GCS_BUCKET = os.environ.get("SAITEJA_ART_BUCKET", "saiteja-blog-art")
GCS_PROJECT = os.environ.get("FIRESTORE_PROJECT_ID", "auracle-prod-311")


def upload_to_gcs(local: Path) -> str | None:
    """Upload a rendered PNG to the public art bucket; return its public URL.
    dest path mirrors the file's path under public/ (e.g. art/blog/x.png)."""
    try:
        from google.cloud import storage
    except Exception:
        return None
    try:
        rel = local.relative_to(PUBLIC).as_posix()
    except ValueError:
        rel = f"art/{local.name}"
    try:
        client = storage.Client(project=GCS_PROJECT)
        blob = client.bucket(GCS_BUCKET).blob(rel)
        blob.cache_control = "public, max-age=31536000, immutable"
        blob.upload_from_filename(str(local), content_type="image/png")
        return f"https://storage.googleapis.com/{GCS_BUCKET}/{rel}"
    except Exception as e:
        print(f"  gcs upload failed (non-fatal): {e}")
        return None

# The shared Auracle brand frame injected into every prompt: dark, cinematic,
# dual-energy. Warm amber (Claude/brain) + cool teal (Gemini/body) meeting at a
# luminous seam. Sacred-geometry-meets-precision-instrument.
BRAND = (
    "Auracle design system — dark, cinematic, premium, precise; sacred geometry "
    "fused with a precision instrument. Deep obsidian background (#0B0F14). Two "
    "energies: warm amber-gold (#F2A85B) and cool teal-cyan (#46C8DD), meeting at "
    "a single luminous warm-to-cool seam. Depth-of-field, fine particulate sparks, "
    "thin geometric yantra line-work. One soft glow at the seam, never neon, never "
    "busy. Editorial negative space. Absolutely no purple, no glassmorphism. "
)

PROMPTS = {
    "og": (
        BRAND + "A 1200x630 landscape social card. Two faint energy currents — one "
        "warm amber, one cool teal — sweeping in from opposite corners to meet at a "
        "single vertical luminous seam left of centre on a deep obsidian field. "
        "Cinematic, calm, premium. Absolutely no text, no words, no letters."
    ),
    "hero": (
        BRAND + "A 1600x900 cinematic abstract header for an essay about: {concept}. "
        "Evoke the idea through the dual-energy seam, fine line networks, and "
        "particulate sparks flying off the cool side — not literal illustration. "
        "No text, no words, no letters."
    ),
    "infographic": (
        BRAND + "A clean 1200x1200 infographic/diagram that shows: {concept}. "
        "Lay out real structure — labelled nodes, a small flow, or a compact "
        "comparison — on a 4px grid with legible correctly-spelled UPPERCASE mono "
        "labels, thin amber and teal connectors on obsidian. One screen, high "
        "contrast, readable on a phone. Diagram, not illustration."
    ),
}


def render(prompt: str, out: Path) -> int:
    out.parent.mkdir(parents=True, exist_ok=True)
    print(f"→ rendering {out.name}")
    r = subprocess.run([GENIMAGE, prompt, str(out)], stdin=subprocess.DEVNULL)
    ok = r.returncode == 0 and out.exists()
    if ok:
        url = upload_to_gcs(out)
        # Machine-readable line the skill / watcher captures:
        print(f"ART_URL: {url}" if url else f"ART_LOCAL: /{out.relative_to(PUBLIC).as_posix()}")
    else:
        print("  FAILED")
    return r.returncode


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    kind = sys.argv[1]
    if kind == "og":
        return render(PROMPTS["og"], ART_DIR / "og.png")
    if kind in ("hero", "infographic"):
        if len(sys.argv) < 4:
            print(f"usage: gen_art.py {kind} <slug> \"<concept>\"")
            return 2
        slug, concept = sys.argv[2], sys.argv[3]
        out = ART_DIR / "blog" / f"{slug}-{kind}.png"
        return render(PROMPTS[kind].format(concept=concept), out)
    print(f"unknown kind: {kind}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
