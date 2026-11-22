# The Pudding: site anatomy (extracted 2026-11-21)

Measured from pudding.cool's shipped CSS and 25 stories (Apr 2025 – Nov 2026),
plus the homepage, header, footer and card system. Values are what the site
ships. Use them as **ratios and roles**. Do not copy them as brand values, because the
brand you are applying supplies its own colours and faces (see `brand-mapping.md`).

## 1. Token layer (shared by every page)

**Grey ramp, 11 steps.** The site's whole chrome is grey. Colour is spent on data.

| token | value | role |
|---|---|---|
| gray-50 | rgb(247,247,247) | input bg, tinted page (walk) |
| gray-100 | rgb(239,239,239) | aside/code bg, default story-card bg |
| gray-200 | rgb(223,223,223) | |
| gray-300 | rgb(202,202,202) | borders, selection |
| gray-400 | rgb(168,168,168) | placeholder, link-hover (dark) |
| gray-500 | rgb(135,135,135) | axis text |
| gray-600 | rgb(109,109,109) | secondary text (light) |
| gray-700 | rgb(78,78,78) | body text on some stories |
| gray-800 | rgb(55,55,55) | |
| gray-900 | rgb(38,38,38) | body text |
| gray-1000 | rgb(25,25,25) | dark-mode page; "black" is never #000 |

**Accents** (homepage brand): purple `#a239ca`, blue `#4717f6`, electric green
`#3AE660` (also the focus ring), red `#ff533d`, yellow `#e5e338` (`<mark>`
highlighter). Stories add a **Paul Tol "bright"** colour-blind-safe categorical
set as tokens: `#4477AA #EE6677 #228833 #CCBB44 #66CCEE #AA3377 #BBBBBB`.

**Type faces:** 3 roles, never more in one view.
- `--serif` reads prose (Tiempos Text 400/700. Gooper SemiCondensed for homepage heds).
- `--sans` is UI, bylines and chart titles (Atlas Grotesk 400/700).
- `--mono` carries data text, ticks, tags, timestamps, form controls (Atlas Typewriter).
- All three are licensed faces. Use open stand-ins (`brand-mapping.md`).

**Fluid size tokens:**
```
--font-size-xsmall: clamp(12px, 1vw, .8rem)
--font-size-small:  clamp(15px, 1.25vw, 1rem)
--font-size-medium: clamp(1rem, 1.75vw, 1.5rem)
--font-size-large:  clamp(1.5rem, 2.5vw, 2.5rem)
--font-size-giant:  clamp(3rem, 4vw, 5rem)
px-named rem steps: 12 14 16 18 20 22 24 28 32 36 40 44 48 56 64 80 96 112 128 (…192)
```
- Body `p` is 18px (20px from 600px up), line-height 1.4–1.65.
- Headings: h1 48, h2 36, h3 28, at weight 500 (or 700/900 for display).
- Weights used: thin 100, normal 400, bold 900.

**Figures:** `font-feature-settings: "tnum" 1, "liga" 0`. Tabular lining numerals are always on, so columns of numbers align.

**Layout:**
- `--width-column-regular: 720px` and `--width-column-wide: 1280px`.
- Story prose columns are 35–40rem (600–650px). Charts break out to 900 / 1000 / 1200 / 1280 / 1600px tiers.
- `--padding: clamp(16px, 12vw, 36px)` and `--margin: 16px`.
- `--width-padded: 80vw` (90vw mobile).

**Shape:**
- `--border-radius: 3px` (2px on stories). 16px only on deliberately soft stories.
- `--stroke-width: 1px`.

**Motion:**
- `--transition-fast .1s`, `--medium .2s`, `--slow .5s`. Hover/state changes are `calc(var(--1s) * .25)`.
- Entrances run 0.5–1s. Pop-ins use a slight overshoot, `cubic-bezier(.2,1.4,.4,1)`.
- Under `prefers-reduced-motion`, `--1s: 1ms`: one token kills all motion.

**Tilt:** `--left-tilt: -2deg`, `--right-tilt: 2deg`, `--*-tilt-double: ±4deg`.

**Layering:** `--z-bottom -100`, `--z-middle 0`, `--z-top 100`, `--z-overlay 1000`.

**Fade:** `--fade: linear-gradient(180deg, bg/0 0%, bg/.8 30%, bg 50%)`, used for "show more" truncation.

**Dark mode** swaps the ramp only: bg gray-1000, fg gray-100, border gray-700. Accents stay.

## 2. Chrome

- **Header.**
  - Left: a small tagline ("A digital publication that explains ideas debated in culture with visual essays").
  - Centre: the wordmark, rotated -2° to -4°. On hover it straightens and scales to 1.05.
  - Right: sticker-image menu buttons (About, Subscribe).
  - `padding-top: 32px`, max-height 120px.
- **Story card (homepage grid).**
  - A square `aspect-ratio: 1` tile in the story's own tint (`--story-bg`), with a 6:7 screenshot anchored to the bottom.
  - Above it, a **mono uppercase 14px info row**: date or topic on the left, a pill ID (`border: 1px solid fg; border-radius: 2em; width: 4em`) on the right.
  - Below it, a **serif hed** at `clamp(24px, 2.75vw, 32px)`, `line-height: 1`, `letter-spacing: -.8px`, and a sans tease 16px in secondary grey.
  - Hover: the info row lifts `translateY(-4px)` and the image scales 1.05.
- **Filter bar.**
  - Sticky, mono uppercase 14px bold.
  - Filter buttons sit at `opacity: .33` and go to 1 when active. Each carries a sticker icon tilted ±2°, tilting further (−6°) on hover.
  - Below 960px the bar becomes a native `<select>`.
- **Inputs:** 1px `rgba(48,48,48,.4)` border, `box-shadow: 0 2px 1px #0000004d`, radius 6px. The flat paper look stays, with a hint of depth.
- **Buttons:** uppercase, `letter-spacing: 1px`, radius 3px. Hover: `translateY(-4px)`.
- **Footer:** related-story cards, then two sticker CTAs (Patreon, newsletter), a donate image tilted 2°, and a sans block.
- **Accessibility chrome on every story:**
  - a hidden "Skip to main content" link
  - a 2px focus outline in `--color-focus`
  - a `prefers-reduced-motion` branch
  - GoatCounter analytics, which is privacy-light

## 3. Story page skeleton (constant across all 25)

1. **Hed.** Huge and playful, 48–260px. Often custom lettering: a Playbill box, cut-out ransom letters, pixel face, hand-lettered image.
2. **Dek.** One line.
3. **Byline block.** Centred sans 13–16px: "By X, with Y, illustrations by Z", then the date.
4. **Hook.** One sentence or one interaction (quiz, choice, game, audio).
5. **How to read it.** Stated before the first chart: "one dot = five speeches; bright = argues democracy is under threat".
6. **Body.**
   - A narrow prose column of serif 18–20px.
   - Figures break out wider, each with a **claim-title**, a dek, the chart and a source line.
7. **Inline caveats** where the reader needs them ("How did you define a motif?").
8. **Methods.**
   - "Data and methods" or "Methodology" at the end, often in collapsible `<details>`.
   - It includes prompts, cut-offs, sample sizes, and AI provenance labelled as such.
9. **Thanks, related stories, footer.**

## 4. Per-story theming rule

Every story keeps the type scale, layout and token *names*. It swaps only
**bg / fg / one accent (sometimes two) / display face**, chosen from the subject:

| story | bg | accent(s) | display |
|---|---|---|---|
| democracy | plum-black `rgb(11,0,13)` | magenta `#ff00d4` | mono |
| motifs | charcoal `#252222` | Playbill yellow `#FDE300`, Wicked green `#AAD04D` | Playbill box |
| wine-animals | `#181A1F` | gold `#F7B956` (interactive), wine `#7b0439` (data) | condensed caps 260px |
| onions | cream `#FFF8EF` | teal `#2B7679` (good), pink `#D553A3` | hand-lettered |
| kids-books | yellow `#FFD85D` | blue he `#66A7DB` / pink she `#D79592` | outlined poster type |
| essential-words | paper `#FFFFF1` | added magenta `#F493FF`, removed amber `#FFAA4A` | Tiempos Headline |
| wnba-politics | tan `#fcfaf7` | WNBA orange `#fa4d00`, navy `#103a63`, one hue per entity | pixel face |
| ethical-champions | white | none: team imagery | Atlas sans |
| pi | white | walker red `#e00` | serif 160px |

- Dark grounds are **tinted** near-blacks: plum, aubergine, violet, charcoal. They are never `#000`.
- Light grounds are **warm** off-whites: paper, cream, tan. They are rarely pure white.
- Serious or analytical pieces go plain white with no accent (ethical-champions).

## 5. Craft details worth stealing

- A highlighter `<mark>` in yellow with `0 4px` padding, sized in `em` so it scales with the text.
- Inline **legend chips in prose**: a coloured span on the category word itself, e.g. "the <span class=added>added</span> words".
- Text over imagery or charts uses a **halo**, either a stack of blurred 1px text-shadows or a solid band with `box-decoration-break: clone`.
- Hand-made texture on a clean scaffold. Examples include tilted stickers, hand-drawn strike-lines, cross-hatched bars, handwritten labels, film grain, ASCII avatars and paper cards rotated 0.1–2°.
- `<details>` with a time cost on the summary: "Click to read more (2 min)".
- A density choice for the reader: TEXT vs TLDR (walk), Parent vs Child (IVF).
- "Text description" `<summary>` under every animation (pi).
- Alt text written per morph step (wnba).
- Progress or position readouts in tabular mono: "0/19", "Zero steps. 368,000 left".
