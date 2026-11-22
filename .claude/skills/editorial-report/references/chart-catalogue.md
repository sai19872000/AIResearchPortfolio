# Chart catalogue: every form seen on pudding.cool, by the question it answers

Pick a chart by the **question**, not by the data shape. Each entry gives the form,
the Pudding story that uses it, how it is annotated, and its **static/print variant**.
Report outputs are static by default, so the print variant is the one you build.

## Question → form

| The reader is asking… | Form | Seen in | Static/print build |
|---|---|---|---|
| How big is this one thing vs the typical one? | **Histogram / bar with one highlighted bar** + dashed average line | birthday-effect (red-hatched bar, "average: 156") | Bars in context grey, one bar in accent, a dashed reference line labelled on the line itself |
| Which items lead, and by how much? | **Ranked horizontal bars**, value labels at bar ends | similes (top 20 nouns for "dry"), ethical-champions | Sort descending. Label every bar directly with no x-axis. Put a callout on the claim ("top 3 = 43%") |
| How does a distribution compare across N groups? | **Small multiples** of a tiny chart, identical scales | similes (one mini bar chart per adjective), mow (path grids) | A CSS grid of 2–6 columns. Shared axis stated once. Highlight the same category in each |
| Where does each item sit on a spectrum? | **Dot / strip plot on a diverging axis** with a centre line | kids-books (animals from he → she), wnba (coverage ratio ±15×) | One row per item. Centre line labelled "equal". Label the ends of the axis in words |
| Two measures, which items are good deals or outliers? | **Scatter with median quadrants** + trendline | wine-animals (price × rating, "good deals" quadrant), similes (specialist vs generalist) | Dashed median lines, the target quadrant shaded and named, and 3–6 named points |
| How much of the whole is X? | **Unit / waffle / dot grid**: 1 mark = 1 (or N) things | aapi-casting (squares per actor), love-story & hello-stranger (1 mark = 1 person), democracy (1 dot = 5 speeches) | A grid of squares or circles with the unit stated in the title ("each square = one role"). Colour the subset |
| How did it change over time? | **Annotated line**, the focal series in accent and the rest grey | kpop (US concerts 2014–26 with "+600%" badges), essential-words | The focal line is 2–2.5px accent, others 1px grey. Label lines at their right end. Annotate 1–3 events in place |
| How did shares shift between two moments? | **Slope chart / before-after dumbbell** | lifeafter (belief wave 1 → 2), essential-words (1953 vs 2023) | Two columns, lines between. Colour up vs down by direction only |
| What is the composition, and how did it move? | **Stream / band chart** or 100% stacked bars | essential-words (21 semantic categories) | Prefer 100% stacked bars (4–8 bands max) with labels inside the bands. Group the rest as "other" |
| What happened when? | **Timeline / event rail** with dots on rows | motifs (song position × motif row), pi (record timeline), democracy (year tick rail) | A horizontal rail with mono year ticks and events as labelled dots. Long runs get a broken axis |
| Where? | **Map** (choropleth, route, embedding-map) | walk (route line drawn by distance), happy-map, menu-collection | Static overview plus 4–6 numbered callout boxes. A route becomes a line with the travelled segment in accent |
| What words or phrases dominate, and for whom? | **Diverging bar of log-odds / ranked word list** | wnba (Fox vs others, insignificant bars greyed), street-view (top 1,000 words) | Two-sided bars. Non-significant bars in context grey, and state the threshold (z < 1.96) |
| How is X connected to Y? | **Network / web** | wnba (web chart), kevin-bacon (degrees, one hue per hop) | Show only the ego network (≤ 30 nodes). Encode hop distance by colour. Name every node shown |
| Which bucket does each fall in, across 3 options? | **Ternary plot** | wnba (Fox / CNN / MSNBC share) | Use it only when the reader already knows the 3 poles. Otherwise use 100% stacked bars |
| What is the shape of a continuous measure? | **Density (KDE)** or beeswarm | essential-words (concreteness KDE), womens-sizing (waistline beeswarm) | Two overlaid densities at most, filled at 30–50% alpha. State the bandwidth in the source line |
| What does a range look like per item? | **Range bars / dot-connected ranges** | womens-sizing (brand size charts, shaded ranges) | One row per item: a range bar in alpha accent, endpoints labelled |
| What is the exact number? | **Big-number stat** + one-line context | kpop growth badges, mow ("30,954 people mowed it") | A stat row of 2–4 numbers. The number is in display type and the label in mono caps under it |
| What do the details look like? | **Table**, compact and tabular | onions (19,320 combinations), pi (records), ethical-champions (top-10) | Right-align numbers, use `tnum`, highlight the row the prose discusses, keep to ≤ 12 rows inline and put the rest in the appendix |
| What is it like for one person? | **Persona / composite protagonist** + their mark highlighted | womens-sizing (median girl), love-story (Henry & Mary), mow ("Bones") | A worked example in prose, plus the same chart with that person's mark in accent and labelled with their name |
| What does the real artefact look like? | **Annotated image / scan** | menu-story (glow regions on a 1915 menu), kids-books (book pages framed by pronoun colour) | An image with numbered callouts and a caption per callout. The frame colour encodes the category |

## Forms Pudding avoids

- **Pie and donut charts.** Never seen in the 25 stories. Use a single 100% bar or a waffle.
- **3D charts.** 3D only appears as a *scene* (lifeafter crowd), never as an encoding.
- **Dual y-axes.** Never. Use two small multiples stacked with aligned x.
- **Standalone legends.** They appear only when marks are many, and even then inline at the top-right at 12px. Default to direct labels.
- **Rainbow / categorical colour for one series.** One series gets one hue.

## Building rules that apply to every form

1. **The title is a claim**, sentence case, ≤ 14 words: "The new list gives more space to abstract ideas, less to the physical world". The **dek** under it says how to read the chart: "Each dot is one film. Coloured dots were cast accurately."
2. **Context first, then the subject.** Draw everything in the context grey (`--ed-context`), then the one subset the sentence is about in `--ed-accent`. Default marks sit at opacity ≈ .7. Dimmed context is ≈ .1–.25 on screen and a solid light grey in print, since opacity looks muddy when printed.
3. **One entity, one colour for the whole document.** If Fox is red in figure 2, it is red in figure 9. Build a colour map once, at the top of the work.
4. **Direct labels.**
   - Label lines at their end, bars at their tip, points next to themselves.
   - A leader line (1px, `--ed-ink` at 50%) joins any label that cannot touch its mark.
   - Reference lines (average, median, "equal", target) are dashed `4 3` and labelled *on* the line.
5. **Numbers carry units and calibration**:
   - "183 birthday deaths", not "183".
   - "+6 is MVP tier, +3 a star, +1 a solid starter".
6. **Chart text is mono**, 11–13px, uppercase for axis names and tick labels, sentence case for annotations. Chart titles are sans or serif bold. Prose stays serif.
7. **Gridlines are optional and faint**: 1px `--ed-rule`, horizontal only, none at all for labelled bars. Show the zero baseline at 1px ink for bars.
8. **Source line under every figure.** Mono, 11px, muted: "Source: CANDOR corpus, 1,656 conversations. Analysis: Valkya Labs."
9. **Alt text / text description for every figure.** Write the sentence a screen-reader user needs: the claim plus the 2–3 numbers. In SVG it goes in `<title>` + `<desc>` or `role="img" aria-label`.
10. **Aspect ratio follows the medium.** Pudding flips charts from 2.5:1 on desktop to 1:2 on mobile instead of squeezing them. For print, a full-width figure is about 16:9 to 2:1, and a small multiple is about 4:3.
11. **Uncertainty in the narrative before the claim.** Sample size, CI or significance threshold go in the dek or source line, never hidden.
12. **Hatching or pattern alongside colour** when the output may be printed in greyscale. Pudding's hand-drawn charts use cross-hatch exactly this way.
