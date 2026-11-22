# Brand mapping: applying the editorial layer to any design system

The editorial layer owns **structure, rhythm, roles and chart grammar**. The brand
owns **colour values, typefaces and the wordmark**. They meet at eleven role
tokens. Map them once per design system and everything else follows.

## The contract: 11 role tokens

| token | role | rule for choosing it from a brand |
|---|---|---|
| `--ed-paper` | page background | the brand's lightest surface. Warm off-white beats pure white |
| `--ed-ink` | body text, baselines | the brand's darkest text colour. Never pure `#000` |
| `--ed-muted` | dek, byline, source lines, secondary text | a brand grey with ≥ 4.5:1 contrast on paper |
| `--ed-rule` | hairlines, gridlines, table rules | a brand border grey, about 15% ink |
| `--ed-context` | **"the rest"** in every chart | a neutral light grey, about 25–35% ink on paper. It must read as background, not as a category |
| `--ed-accent` | **the subject** in every chart, links, kicker | the brand's primary. If two brand colours compete, the one with more contrast on paper wins |
| `--ed-accent-2` | the second series, used only when a comparison needs two | the brand's secondary, or a complementary hue at a similar lightness |
| `--ed-mark` | highlighter behind words (`==text==`) | a light, high-chroma tint, about 35% alpha of a warm brand colour (or yellow) |
| `--ed-serif` | prose | the brand's serif. If there is none, use an open serif from the same superfamily (Plex Sans → **IBM Plex Serif**) or Source Serif 4 / Newsreader |
| `--ed-sans` | titles, UI, byline, chart titles | the brand's sans / display |
| `--ed-mono` | chart text, ticks, kicker, metadata, numbers in tables | the brand's mono. If there is none, use IBM Plex Mono or JetBrains Mono |

Categorical series beyond two use the **Tol bright** set (`--ed-cat-1…7`): `#4477AA #EE6677 #228833 #CCBB44 #66CCEE #AA3377 #BBBBBB`. Colour-blind safety beats brand there. Swap a brand hue in only when it passes a CVD check (`dataviz` skill's validator).

## Ready mappings

### Valkya Labs (client deliverables: `auracle doc`)
```css
--ed-paper:#fafafa; --ed-ink:#0b1729; --ed-muted:#5a6678; --ed-rule:#d8dde4;
--ed-context:#c3cad4; --ed-accent:#1a4d8f; --ed-accent-2:#b08d4a;
--ed-mark:rgba(176,141,74,.28);
--ed-serif:"IBM Plex Serif",Georgia,serif; --ed-sans:"Instrument Sans","IBM Plex Sans",sans-serif;
--ed-mono:"IBM Plex Mono",ui-monospace,monospace;
```
Navy `#1a4d8f` is 8.0:1 on paper. Gold `#b08d4a` is 3.0:1: use it for marks and the highlighter, never for text. This is wired by default: `editorial.css` reads Valkya's own `--ink/--paper/--accent/--gold` tokens, so nothing needs setting. Plex Serif ships embedded.

### Auracle (factory / internal reports: dark-first, dual energy)
```css
--ed-paper:#F4F1EA; --ed-ink:#16110B; --ed-muted:#4B5560; --ed-rule:#AEB7C0;
--ed-context:#C9C3B6; --ed-accent:#9C5E22 /* warm-deep: 4.6:1 on paper, AA for text */; --ed-accent-2:#1C6675 /* cool-deep: 5.8:1 */;
--ed-mark:rgba(242,168,91,.35);
--ed-serif:"Fraunces",Georgia,serif; --ed-sans:"Hanken Grotesk",sans-serif; --ed-mono:"JetBrains Mono",monospace;
/* dark: paper #0B0F14 (obsidian), ink #EAEDEF, accent #F2A85B (warm), accent-2 #46C8DD (cool), context #2A323B */
```
- Warm = the subject and cool = the comparison, matching the brand's dual-energy rule.
- amber-700 `#C97E36` is only 2.85:1 on this paper. Use it for large filled marks next to a warm-deep label, never for text or thin lines.
- Keep the seam gradient as the one decorative touch (kicker underline). Never put it on data marks.

### Spanda (emerald)
```css
--ed-paper:#EFF4F1; --ed-ink:#0A130F; --ed-muted:#45564E; --ed-rule:#C9D6CF;
--ed-context:#B7C6BE; --ed-accent:#0A7C56 /* accent-deep: 4.7:1 on paper */; --ed-accent-2:#3F7FB8 /* 3.8:1: marks only, not text */;
--ed-mark:rgba(61,226,166,.30);
--ed-serif:"Newsreader",Georgia,serif; --ed-sans:"Bricolage Grotesque","Space Grotesk",sans-serif; --ed-mono:"JetBrains Mono",monospace;
/* dark: paper #1E2D27, ink #ECF3EE, accent #3DE2A6, context #2F4239 */
```

### Pudding-neutral (no brand given)
```css
--ed-paper:#fdfcf8; --ed-ink:#262626; --ed-muted:#6d6d6d; --ed-rule:#dfdfdf;
--ed-context:#cacaca; --ed-accent:#4717f6; --ed-accent-2:#ff533d; --ed-mark:#e5e33899;
--ed-serif:"Source Serif 4","IBM Plex Serif",Georgia,serif; --ed-sans:"Inter","IBM Plex Sans",system-ui,sans-serif;
--ed-mono:"IBM Plex Mono",ui-monospace,monospace;
```

### A design system not listed here
1. Read its tokens: CSS variables, a `tokens/` dir, Figma variables, or the brand's live site.
2. Fill the 11 roles using the "rule for choosing" column. Write the mapping block into the brand's skill or assets so the next run reuses it.
3. **Measure contrast** (compute the WCAG ratio; never copy a "passes AA" note from a token file) for each pair: ink/paper ≥ 7:1, muted/paper ≥ 4.5:1, accent/paper ≥ 3:1 for marks (≥ 4.5:1 if accent is used for text), context/paper ≤ 1.8:1 (it must recede).
4. Pick **one** decorative signature from the brand. The house equivalent of Pudding's tilted wordmark might be a seam line, a stamp, or a kicker chip. Use it once per page at most.

## Fonts: licensing

- Pudding's faces (Tiempos, Atlas Grotesk / Typewriter, Gooper) are commercial licences. **Never hotlink or embed them.**
- Use the brand's own faces or OFL stand-ins:

| Pudding face | OFL stand-in |
|---|---|
| Tiempos Text | IBM Plex Serif, Source Serif 4, Newsreader |
| Gooper / Tiempos Headline | Fraunces, Newsreader Display |
| Atlas Grotesk | IBM Plex Sans, Inter, Hanken Grotesk |
| Atlas Typewriter | IBM Plex Mono, JetBrains Mono |

- Self-contained deliverables **embed** fonts as woff2 data URIs. A CDN `<link>` fails silently offline.
- Only IBM Plex Serif ships embedded (`assets/_serif.css`). Any other face a mapping names (Fraunces, Hanken Grotesk, JetBrains Mono, Newsreader...) must be embedded the same way by the page, or it falls back to the next family in the stack. Check the rendered page, not the CSS.
