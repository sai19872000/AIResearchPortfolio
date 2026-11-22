# Editorial Report Layer for `saiteja.ai` Blogger

**Date:** 2026-11-21
**Status:** Approved

## Intent & Why
Upgrade `saiteja.ai`'s automated blogger pipeline (`blog_watcher.py`, `gen_art.py`, `linkedin_pipeline.py`, `blog_bot.py`) and Next.js article renderer (`components/site/markdown.tsx`, `app/globals.css`) to full parity with the `editorial-report` skill (The Pudding's visual-essay grammar, applied on top of Auracle's dark dual-energy brand).

Previously, all post visuals were static Nano Banana PNGs embedded in plain markdown. Nano Banana works well for abstract hero imagery and conceptual architecture diagrams, but raster image generation mis-plots quantitative curves (e.g., drawing an S-curve for exponential `0.95^n` decay) and cannot support wide breakout charts, tabular `stats` callout strips, `==highlights==`, or claim-titled figure anatomy (`title → dek → graphic → source`).

## Approaches Considered
1. **Prompt-only upgrade** (update `blog_watcher.py` + `gen_art.py` prompts only): fast, no Next.js changes, but quantitative charts remain hallucination-prone raster PNGs with no wide breakout or `stats`/`figure` components.
2. **Full `editorial-report` layer on `saiteja.ai` + upgraded Nano Banana + LinkedIn chart rasterizer *(selected)***:
   - Code-computed inline SVG inside ```` ```figure ```` blocks for quantitative data, benchmarks, curves, rankings, and step sequences.
   - Upgraded `editorial-report`-disciplined Nano Banana prompts for hero art and conceptual diagrams.
   - Headless-Chrome rasterization (`scripts/render_figure.py`) of the lead ```` ```figure ```` to GCS (`leadFigureImage`) so LinkedIn and Telegram get the exact same Pudding chart as the blog.

## Key Design Decisions
- **Typography (builder call):** Keep `saiteja.ai`'s existing Auracle faces (`Fraunces` display/headings, `Hanken Grotesk` body prose, `JetBrains Mono` chart text, ticks, metadata, tabular numbers).
- **Auracle dark token mapping on `.ed`:** `--ed-paper: #0B0F14`, `--ed-ink: #EAEDEF`, `--ed-muted: #AEB7C0`, `--ed-rule: rgba(255,255,255,.10)`, `--ed-context: #3A4552`, `--ed-accent: #F2A85B` (subject), `--ed-accent-2: #46C8DD` (comparison), `--ed-mark: rgba(242,168,91,.24)`.
- **Security (fail-closed):** `lib/editorial.ts` and `scripts/render_figure.py` enforce an explicit allowlist of inert SVG/layout tags and reject `<script>`, `<iframe>`, `<foreignObject>`, `<style>`, `on*=` handlers, `javascript:`, `@import`, and external `src`/`href`/`url()` references. Missing `alt:` is also rejected. Raw HTML remains disabled in prose (`rehype-raw` is NOT enabled); `==highlight==` and simple `<sup>`/`<sub>` are handled via an AST remark transform.
- **Backward compatibility:** All 277 existing Firestore posts without ```` ```figure ```` or ```` ```stats ```` blocks continue rendering unchanged.
- **Rollout order:** Unblock `auracle-sitedeploy` (one-time `evidence_exception` for `71de29f`) and deploy the Next.js frontend to Cloud Run before/alongside restarting `saiteja-blog-watcher` with the updated prompt so live `saiteja.ai` renders ```` ```figure ```` and ```` ```stats ```` cleanly.
