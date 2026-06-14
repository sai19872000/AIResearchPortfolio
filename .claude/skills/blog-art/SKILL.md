---
name: blog-art
description: Generate on-brand (Auracle) art for a saiteja.ai blog post — a hero image plus inline infographics — with nano-banana (Gemini 3 Pro Image, $0 on the Ultra sub). Use this while writing any blog post: every post gets a hero; add an infographic wherever a concept is better shown than told.
---

# blog-art — visuals for the blog

You are writing a post for saiteja.ai. Give it visuals with this skill. The
renderer is `scripts/gen_art.py`; it bakes the **Auracle** look into every prompt
(obsidian `#0B0F14`, warm amber `#F2A85B` + cool teal `#46C8DD` meeting at a
luminous seam, fine line-work, no neon, no purple) and uploads the PNG to the
public art bucket, printing the URL.

## What every post gets

1. **One hero image** — abstract, cinematic, evokes the post's idea (never a
   literal scene, never text in the image).
2. **One to two inline infographics** — ONLY where a concept is genuinely
   clearer shown than told (an architecture, a tradeoff, a pipeline, a
   comparison). Skip them if the post is purely narrative. Never decorative.

## How to render

Run from the repo root. Each call prints a line `ART_URL: https://…` — capture
that URL and use it.

```
# hero (once per post). <slug> = the post's slug.
python scripts/gen_art.py hero <slug> "<one phrase naming the post's core idea>"

# infographic (0–2 per post). Give it the ACTUAL content to lay out.
python scripts/gen_art.py infographic <slug>-1 "<what the diagram must show: the nodes, steps, or the two sides being compared — be specific>"
```

If a call prints `ART_LOCAL: /art/...` instead of `ART_URL:` (bucket upload
unavailable), use that local path — it will show after the next deploy.

## Writing good prompts

- **Hero:** name the idea, not a literal picture. "the gap between a frontier
  API and a fine-tuned small model" → the renderer handles the Auracle styling.
- **Infographic:** state the real structure and the labels you want — the
  renderer demands legible, correctly-spelled UPPERCASE mono labels on a 4px
  grid. Keep it to one screen, ≤4 colors, readable on a phone. After it renders,
  the label text must be legible and correct; if a prompt is too vague the labels
  come out garbled — re-run with the exact labels spelled in the prompt.

## Putting art in the post

- Set the post's `heroImage` to the hero `ART_URL`.
- Embed each infographic inline in the markdown where it belongs, with a real
  alt + caption:

  ```
  ![<concise alt>](<infographic ART_URL>)
  ```

- Never hotlink external stock images. Only use art you rendered here.

Done.
