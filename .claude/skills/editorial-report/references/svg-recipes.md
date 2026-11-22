# SVG recipes: static charts in the editorial grammar

**Hand-written or code-generated inline SVG.** It carries no colours of its own, only grammar
classes (`ctx`, `subj`, `ref`, `lbl`, `annot`, `halo`), so the brand tokens
restyle every chart and a palette change never means re-drawing.

Rules for every recipe:
- `class="ed-chart"` on the `<svg>`, plus a `viewBox`. No `width`/`height` attributes: the figure body sizes it to 100%.
- Lay out in a viewBox of **640 wide** (a reading-measure figure) or **960 wide** (`width: wide`). The text then lands at a readable size.
- Compute positions in code (Python/JS) from the real data. **Never eyeball coordinates**, because a label that is 4px off reads as a wrong number.
- Every number printed on the chart must come from the data file, not from memory.
- Wrap in a ```` ```figure ```` block with `title` (claim), `dek` (how to read), `source`, `alt`.

## 1. Ranked bars, one subject highlighted, direct labels, no x-axis

The most common report chart: "which leads, by how much", e.g. similes' top nouns.

````markdown
```figure
title: Three product families account for 71% of manual reviews
dek: Share of the 412 specs that needed a reviewer, by product family.
source: Source: LIMS export, Jan–Oct 2026, n = 412 specs. Analysis: Valkya Labs.
alt: Ranked bar chart. Tablets 38%, Capsules 21%, Injectables 12%, then four smaller families from 9% down to 4%.

<svg class="ed-chart" viewBox="0 0 640 238">
  <!-- row = 30px; label column 150px; bar scale: 38% → 400px -->
  <g class="rows" transform="translate(150,8)">
    <text class="lbl" x="-10" y="15" text-anchor="end">Tablets</text>
    <rect class="subj" x="0" y="2" width="400" height="18"/>
    <text class="lbl-subj" x="406" y="15">38%</text>

    <text class="lbl" x="-10" y="45" text-anchor="end">Capsules</text>
    <rect class="subj" x="0" y="32" width="221" height="18"/>
    <text class="lbl-subj" x="227" y="45">21%</text>

    <text class="lbl" x="-10" y="75" text-anchor="end">Injectables</text>
    <rect class="subj" x="0" y="62" width="126" height="18"/>
    <text class="lbl-subj" x="132" y="75">12%</text>

    <text class="lbl" x="-10" y="105" text-anchor="end">Creams</text>
    <rect class="ctx" x="0" y="92" width="95" height="18"/>
    <text class="lbl" x="101" y="105">9%</text>
    <!-- …remaining rows in .ctx… -->
    <line class="baseline" x1="0" y1="0" x2="0" y2="216"/>
  </g>
  <!-- the claim, annotated on the chart itself -->
  <path class="leader" d="M 560 30 L 560 90 L 420 90"/>
  <text class="annot-strong" x="566" y="40">71%</text>
  <text class="annot" x="566" y="56">in the top</text>
  <text class="annot" x="566" y="72">three</text>
</svg>
```
````

## 2. Annotated line: the focal series in accent, the rest grey, end labels

````markdown
```figure
title: Review time fell by half once rules moved to the client's workbook
dek: Median hours from spec upload to approval, per week. Other sites shown in grey.
source: Source: workflow log, weeks 1–40 2026. Median of 18–64 specs per week.
alt: Line chart. Site A's median review time drops from about 9 hours to 4.5 hours after week 22; the other four sites stay between 6 and 9 hours.
width: wide

<svg class="ed-chart" viewBox="0 0 960 320">
  <g transform="translate(48,16)">
    <!-- y gridlines only, faint; labels at left -->
    <g class="grid"><line x1="0" x2="820" y1="0" y2="0"/><line x1="0" x2="820" y1="90" y2="90"/>
      <line x1="0" x2="820" y1="180" y2="180"/></g>
    <text x="-8" y="4" text-anchor="end">12h</text><text x="-8" y="94" text-anchor="end">8h</text>
    <text x="-8" y="184" text-anchor="end">4h</text>
    <line class="baseline" x1="0" x2="820" y1="270" y2="270"/>
    <text class="axis-title" x="0" y="292">Week</text>
    <!-- context series first -->
    <path class="ctx-line" d="M0,100 L205,92 L410,110 L615,96 L820,104"/>
    <path class="ctx-line" d="M0,70 L205,80 L410,64 L615,76 L820,72"/>
    <!-- event marker: a dashed ref line labelled ON the line -->
    <line class="ref" x1="451" x2="451" y1="0" y2="270"/>
    <text class="annot halo" x="457" y="14">Week 22: rules move to client workbook</text>
    <!-- subject last, so it sits on top -->
    <path class="subj-line" d="M0,62 L205,58 L410,70 L451,72 L520,150 L615,166 L820,168"/>
    <text class="lbl-subj" x="826" y="172">Site A · 4.5h</text>
    <text class="lbl" x="826" y="108">Other sites</text>
  </g>
</svg>
```
````

## 3. Dot strip on a diverging axis: where each item sits on a spectrum

Like kids-books' he/she axis or wnba's coverage ratio.

```html
<svg class="ed-chart" viewBox="0 0 640 200">
  <g transform="translate(140,24)">
    <line class="ref" x1="240" x2="240" y1="-14" y2="160"/>
    <text class="lbl" x="240" y="-18" text-anchor="middle">equal</text>
    <text class="axis-title" x="0" y="176">← under-covered</text>
    <text class="axis-title" x="480" y="176" text-anchor="end">over-covered →</text>
    <!-- one track per row -->
    <line class="grid" x1="0" x2="480" y1="10" y2="10"/>
    <text class="lbl" x="-10" y="14" text-anchor="end">Clark</text>
    <circle class="subj" cx="430" cy="10" r="7"/>
    <text class="lbl-subj halo" x="430" y="-2" text-anchor="middle">3.5×</text>
    <line class="grid" x1="0" x2="480" y1="40" y2="40"/>
    <text class="lbl" x="-10" y="44" text-anchor="end">Wilson</text>
    <circle class="ctx" cx="214" cy="40" r="6"/>
    <!-- … -->
  </g>
</svg>
```

## 4. Unit / waffle grid: "1 square = 1 thing", colour the subset

Generate it in code. A 20 × 10 grid = 200 units:

```python
def waffle(n_total, n_subj, cols=20, size=14, gap=3, label_unit="spec"):
    out = ['<svg class="ed-chart" viewBox="0 0 {w} {h}">'.format(
        w=cols * (size + gap), h=((n_total + cols - 1) // cols) * (size + gap) + 4)]
    for i in range(n_total):
        x, y = (i % cols) * (size + gap), (i // cols) * (size + gap)
        cls = "subj" if i < n_subj else "ctx"
        out.append(f'<rect class="{cls}" x="{x}" y="{y}" width="{size}" height="{size}" rx="2"/>')
    out.append("</svg>")
    return "".join(out)
```
Put the unit in the dek: "Each square is one spec. Filled squares needed manual review."

## 5. Slope: before → after, coloured by direction only

```html
<svg class="ed-chart" viewBox="0 0 640 260">
  <g transform="translate(180,30)">
    <text class="axis-title" x="0" y="-12" text-anchor="middle">2025</text>
    <text class="axis-title" x="280" y="-12" text-anchor="middle">2026</text>
    <line class="ctx-line" x1="0" y1="40" x2="280" y2="60"/>       <!-- small move: context -->
    <line class="subj-line" x1="0" y1="150" x2="280" y2="20"/>     <!-- the story -->
    <circle class="subj" cx="0" cy="150" r="4"/><circle class="subj" cx="280" cy="20" r="4"/>
    <text class="lbl" x="-10" y="154" text-anchor="end">Automated naming 18%</text>
    <text class="lbl-subj" x="290" y="24">83%</text>
  </g>
</svg>
```

## 6. Step sequence: scrollytelling flattened for paper

Draw the same chart 2–4 times, adding one layer per frame. This is raw HTML inside a figure:

````markdown
```figure
title: Each adjustment narrows the gap until only one plant remains an outlier
dek: The same chart three times. Each frame adds one correction.
source: Source: batch records 2024–26, n = 1,920 batches.
alt: Three frames. Raw yield gap 14 points; after strength adjustment 6 points; after season adjustment only Plant C remains outside the band.
width: wide

<div class="ed-steps">
  <div class="ed-step"><svg class="ed-chart" viewBox="0 0 300 180">…frame 1…</svg>
    <p class="ed-step-cap">Raw yield: a 14-point gap.</p></div>
  <div class="ed-step"><svg class="ed-chart" viewBox="0 0 300 180">…frame 2…</svg>
    <p class="ed-step-cap">Adjusted for strength: 6 points.</p></div>
  <div class="ed-step"><svg class="ed-chart" viewBox="0 0 300 180">…frame 3…</svg>
    <p class="ed-step-cap">Adjusted for season: only Plant C stays outside.</p></div>
</div>
```
````

## 7. Hatching, for greyscale-safe categories

Declare the pattern once per SVG and use it on the mark that must survive a black-and-white printer:

```html
<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <rect width="5" height="5" class="subj" opacity=".25"/><line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" stroke-width="1.6"/>
</pattern></defs>
<rect x="0" y="0" width="80" height="18" fill="url(#hatch)" style="color: var(--ed-accent)"/>
```
(`url(#id)` references inside the same document are allowed. Only network `url()` is refused.)

## Interactive outputs (HTML artifacts, dashboards, explainers)

When the output is a live page rather than a printed document, the same grammar applies, plus Pudding's motion rules:
- Hover/state transitions take 0.2–0.25s. Entrances take 0.5–1s. A pop-in has a slight overshoot, `cubic-bezier(.2,1.4,.4,1)`.
- One `--1s` token that collapses to `1ms` under `prefers-reduced-motion`.
- The tooltip is inverted (ink background, paper text, mono 12px) and sits at `translate(-50%, calc(-100% - 8px))`, with radius 3–4px.
- Hover states: dim the rest to 0.1–0.25 and keep the hovered mark at 1.
- On touch (`@media (hover: none)`), every hover reveal also needs a tap or an always-visible label.
- Scrollytelling: a sticky graphic at `top: calc(50vh - h/2)` with steps at `min-height: 90svh` and `IntersectionObserver` thresholds. Never scroll-jack.
- Mobile is a redesign, not a shrink: flip the chart aspect from 2.5:1 to about 1:2 and move labels outside the marks.
