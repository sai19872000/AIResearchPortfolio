---
name: editorial-report
description: Editorial data-storytelling layer for every report output, distilled from The Pudding (pudding.cool) visual essays. Use whenever you produce a report a person will read, with charts or without — client deliverable, assessment, evaluation, analysis, research summary, status or retro report, explainer, HTML artifact or dashboard page. It is design-system agnostic. It keeps the brand in force (Valkya, Auracle, Spanda, a client's) and adds structure, type roles, highlight-the-subject colour discipline, claim-titled annotated charts, and print-safe figures. Covers chart choice by question, SVG chart recipes, narrative patterns, brand token mapping, and the `auracle doc` figure/stats/highlight syntax.
---

# Editorial report: the Pudding grammar, on any brand

The Pudding makes data essays people actually read. They do it with a small, strict
grammar that has nothing to do with their brand colours:

- one claim per figure
- the subject in colour, everything else in grey
- labels on the data
- serif prose, mono numbers
- a narrow reading column with wide figures
- methods at the end

This skill is that grammar. It was extracted from the site's CSS and 25 stories
(2025–26). **Apply it to every report output.** The brand supplies colours, faces and
wordmark; this layer supplies everything else.

| Read | When |
|---|---|
| `references/chart-catalogue.md` | choosing a chart (by the reader's question), and the 12 rules every chart follows |
| `references/svg-recipes.md` | drawing it: copy-ready SVG for bars, lines, strips, waffles, slopes, step sequences |
| `references/narrative-patterns.md` | structuring the report: hooks, "add one variable at a time", decoy→correction, endings |
| `references/brand-mapping.md` | the 11 role tokens, with ready mappings for Valkya, Auracle, Spanda, neutral, and how to map any other system |
| `references/print-degradation.md` | turning interactive ideas (scrolly, hover, sliders) into static HTML/PDF |
| `references/site-anatomy.md` | the measured source: every token, type size, layout width, chrome detail |

## The ten non-negotiables

1. **Every section heading and figure title is a finding, not a topic.** Write "Three families cause 71% of reviews", not "Review analysis". Keep numbering if the document has it: `## 3. Three families cause 71% of reviews`.
2. **Context grey, subject accent.** Draw every mark in `--ed-context`, then colour only what the sentence is about in `--ed-accent`. Use a second accent only for a genuine comparison. Use the Tol set only for ≥ 3 true categories.
3. **One entity, one colour, for the whole document.** Decide the colour map before drawing figure 1.
4. **Label the data directly.** Put labels at line ends and bar tips. Put reference lines (average, target, "equal") dashed, labelled on the line. Use a legend only when marks are too many to label, and then inline.
5. **Every figure has title (claim) → dek (how to read: "each dot = one batch") → graphic → source line (provenance, n, threshold) → alt text.**
6. **Type roles are fixed.** Serif carries prose. Sans carries titles, UI and byline. Mono carries chart text, ticks, table figures, metadata and kickers. Numbers are tabular. Use at most three families.
7. **Numbers carry units and calibration.** Write "183 deaths (average 156)" and "+6 is MVP tier". Never leave a bare number.
8. **Uncertainty before the claim.** State the sample size, interval or threshold in the dek or source, not in a footnote nobody reads.
9. **Pick the chart by the question** (catalogue). Never use pie, donut, 3D, dual-axis, or a rainbow colouring of a single series.
10. **Inline definition where needed, full methods at the end.** Methods covers sources, filters, cut-offs, models and prompts. Label AI-generated content as AI-generated.

Plus the voice rule: plain, exact, short sentences that carry numbers, with no filler. It must not read AI-written.

## Workflow

1. **Find the brand.** Identify which design system governs this output: a client deliverable is Valkya, a factory/internal page is Auracle, a Spanda-branded product is Spanda, and anything else uses that system's tokens. Map the 11 `--ed-*` roles (`brand-mapping.md`). If none is given, use Pudding-neutral.
2. **Write the spine before any chart:**
   - the hook (the single most important finding, with its number)
   - 3–6 claim-headings
   - the recommendation
   - methods notes
3. **For each claim, choose one hero figure** by the reader's question. If a claim needs a complex chart, build it up in 2–4 step frames instead (`ed-steps`).
4. **Draw from data, in code.** Compute SVG coordinates from the real numbers. Every printed number traces to the data file. Use the grammar classes only, never inline colours.
5. **Render, then look at it** (below). Fix the reading order first and polish second.

## In `auracle doc` (client deliverables): already wired

`bin/auracle doc file.md [--pdf]` renders with this layer **by default**. `theme: classic` in
front matter opts out. Valkya's tokens map automatically, and IBM Plex Serif is embedded
(OFL) as the open stand-in for Pudding's Tiempos. The layer adds:

````markdown
---
title: Specs split cleanly by product family
kicker: Assessment · Lupin MDM · Round 3       ← mono caps line above the hed
subtitle: What 412 specs say about where manual review time goes.   ← the dek
...
---

Three families cause ==71% of manual reviews==.        ← highlighter <mark>

```stats
71% | of reviews | from three families
412 | specs analysed | Jan–Oct 2026
4.5h | median review | down from 9h
```

```figure
title: Three product families account for 71% of manual reviews
dek: Share of the 412 specs that needed a reviewer, by product family.
source: Source: LIMS export, Jan–Oct 2026, n = 412.
alt: Ranked bar chart. Tablets 38%, Capsules 21%, Injectables 12%, then four families from 9% to 4%.
width: wide

<svg class="ed-chart" viewBox="0 0 640 238">…</svg>
```
````

How the blocks behave:
- **Table cells** holding only a number are right-aligned and tabular automatically. A row containing `==…==` is highlighted.
- **Figures must be inert.** Script, event handlers, `javascript:`, iframes, network `src`/`href`/`url()` and `@import` are **refused with an error**, as is a figure without `alt:`. Images go in as `data:` URIs.
- **Other markup in prose.** For a legend chip, use `<span class="ed-chip" style="--c:var(--ed-cat-2)">removed</span>`. Classes such as `ed-aside` are available inside figure blocks (raw HTML is only passed through there).

## Outside `auracle doc` (artifacts, dashboards, pitch/explainer pages, other repos)

- Inline `assets/editorial.css`, plus a serif such as `assets/_serif.css`, and put `class="ed"` on the content root.
- Give that root a reading column. The layer styles content but does not set a width, and `ed-wide` breaks out of whatever column it sits in. Add `class="ed ed-page"` for the default (42rem column, 16px gutters), or size the column yourself.
- Set the `--ed-*` block for the brand on `.ed`.
- Use the same figure markup:

```html
<figure class="ed-figure ed-wide">
  <p class="ed-fig-title">…claim…</p><p class="ed-fig-dek">…how to read…</p>
  <div class="ed-fig-body" role="img" aria-label="…alt…"><svg class="ed-chart" …>…</svg></div>
  <figcaption class="ed-fig-source">Source: …</figcaption>
</figure>
```

For live pages, add the motion and interaction rules at the end of `svg-recipes.md`. The `dataviz` skill complements this one: it covers palette validation and chart-library specifics. Where the two disagree, **this skill governs report structure and emphasis, and `dataviz` governs colour-validity checks.**

## Before you say done (verify the artifact, not the source)

- **Render it and look.**
  - Take a headless-Chrome screenshot of the HTML, or render `--pdf`, then read the page images.
  - Check that every figure title states a claim, that the accent marks exactly the subject the sentence names, and that no label collides.
- **Re-derive every number on every chart from the data file.** State coverage as a count you computed ("all 14 figure numbers checked against `results.csv`").
- **Squint test.**
  - At thumbnail size, the one coloured thing on each figure should be the finding.
  - If two things shout, demote one to `ctx`.
- **Greyscale check** for anything that will be printed: the subject must still be distinguishable (hatch or label).
- **The PDF page count is sane**, and no figure is split across pages.
