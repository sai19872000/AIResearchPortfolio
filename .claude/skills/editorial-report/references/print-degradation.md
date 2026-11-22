# Interactive → static: how each Pudding device degrades for HTML/PDF reports

Pudding pieces are interactive. Our reports are mostly read as a self-contained HTML
file or a printed PDF. The aim is to **keep the reading order the interaction
created**, not to imitate the interaction.

| Web device | Stories | Static replacement |
|---|---|---|
| Sticky graphic + stepping text (scrollytelling) | democracy, womens-sizing, motifs, love-story, aapi-casting | A **numbered step sequence**: the same chart drawn 2–4 times, one new highlight per frame, with the step's sentence as caption. Use the `.ed-steps` grid |
| Chart morph (dot plot → ternary) | wnba | Two figures side by side with a "→" and one caption explaining the mapping |
| Add-one-variable rebuild | ethical-champions | Frames in a row: "1 · games missed", "2 · + impact", "3 · + low-minute games" |
| Hover tooltip / Voronoi | wine-animals, kevin-bacon, aapi-casting | **Direct-label the 3–6 marks the prose talks about**, then put the full data in an appendix table |
| Click-a-person / detail shelf | love-story, hello-stranger | One **pull-quote card** next to the chart, with that person's mark in accent |
| Search yourself / find a word | similes, kids-books, wnba | A short lookup table in the appendix, sorted by the reader's likely key |
| Sliders, toggles, "explode" | onions, wine-animals, kevin-bacon (time slider) | **2–4 pre-set states side by side** (best case labelled "winner"), or small multiples by year |
| Quiz / guess first | similes, kevin-bacon, mow | A one-line "Guess first" aside, with the answer in the next sentence. At most once per document |
| Reader chooses density (TEXT/TLDR, Parent/Child) | walk, ivf | Summary up front, full detail behind it, using **progressive disclosure**: `<details>` on screen, expanded in print |
| `<details>` methods accordion | essential-words, kids-books | Expanded in print (`@media print { details { display:block } }`), collapsed on screen with a time cost in the summary |
| Audio, video, video wall, CRT effects | motifs, kpop, wnba, lifeafter | **One still and a caption**, plus a transcript line if words matter |
| Zoomable / WebGL map | happy-map, menu-collection | A static overview plus 4–6 numbered callouts and one inset |
| 3D crowd / canvas sprites | lifeafter, love-story, democracy | A **unit chart** (1 mark = N people), grouped by category |
| Animated counters / route drawing | walk, pi | The end state, with the progression as a mini timeline |
| Dark full-bleed theme | most culture pieces | Screen: honour `prefers-color-scheme`. **Print is always light**: same accent, re-checked for contrast on paper |
| Display type at 128–260px | birthday-effect, wine-animals, pi | Cap at about 48–72pt in print, and keep the weight and case |
| Colour-only categories | everywhere | Add a **direct label or hatch pattern**, so the chart survives greyscale printing and colour-blind readers |
| Hover-only affordances | — | Everything visible by default. Print has no hover |
| Tilt / sticker / hand-made texture | chrome, motifs, menu-story | Keep it to **one or two** decorative touches (kicker chip, a tilted stamp). Never on data marks or text that must be read precisely |

## What always survives and must be kept

- Serif prose, mono data text, sans UI and titles.
- One accent on a quiet base. Context in grey, the subject in colour.
- Claim titles, a dek that teaches the reading, and a source line under each figure.
- One entity, one colour, across the whole document.
- Inline definitions, plus a full methods appendix.
- Tabular numerals and numbers with units.
- Alt text and text descriptions.
