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
import subprocess, sys
from pathlib import Path

GENIMAGE = "/home/sai/auracle/bin/genimage"
ART_DIR = Path(__file__).resolve().parent.parent / "public" / "art"

# The shared Aura brand frame injected into every prompt.
BRAND = (
    "Aura design system, 'quietly forged' — restrained, editorial, precise. "
    "Deep navy ink background (#0A0E1A) with a faint cosmic grain. Periwinkle "
    "(#8AB6FF) as the only accent. Cream (#F4F1EA) for any light tone. Flat, "
    "no drop shadows, hairline aesthetic, generous negative space. Calm and "
    "high-end, never loud, never neon, never busy. "
)

PROMPTS = {
    "og": (
        BRAND + "A 1200x630 landscape social card. A single set of three thin "
        "concentric periwinkle rings (a quiet breathing mark) sitting left of "
        "centre on a uniform deep-navy field with one soft periwinkle glow. "
        "Balanced, symmetrical calm. Absolutely no text, no words, no letters."
    ),
    "hero": (
        BRAND + "A 1600x900 abstract header image for an essay about: {concept}. "
        "Evoke the idea through minimal geometric forms, fine line networks, or "
        "a subtle field — not literal illustration. No text, no words, no letters."
    ),
    "infographic": (
        BRAND + "A clean 1200x1200 infographic/diagram that shows: {concept}. "
        "Lay out real structure — labelled nodes, a small flow, or a compact "
        "comparison — using a 4px grid, legible correctly-spelled mono labels, "
        "thin periwinkle connectors on navy. One screen, high contrast, readable "
        "on a phone. Diagram, not illustration."
    ),
}


def render(prompt: str, out: Path) -> int:
    out.parent.mkdir(parents=True, exist_ok=True)
    print(f"→ rendering {out.name}")
    r = subprocess.run([GENIMAGE, prompt, str(out)], stdin=subprocess.DEVNULL)
    print("  ok" if r.returncode == 0 and out.exists() else "  FAILED")
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
