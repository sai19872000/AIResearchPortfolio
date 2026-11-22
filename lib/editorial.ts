/**
 * Editorial report layer (Pudding grammar) parser, fail-closed SVG sanitizer,
 * and remark inline plugin for saiteja.ai blog posts.
 *
 * Pure module (zero React/DOM dependencies) so it can be unit-tested directly
 * with `node --test` and reused identically on live posts and draft previews.
 */

export interface StatItem {
  value: string
  label: string
  context: string
}

export interface FigureBlock {
  title: string
  dek: string
  source: string
  alt: string
  wide: boolean
  markup: string | null
  error: string | null
}

export type EditorialSegment =
  | { kind: 'markdown'; text: string }
  | { kind: 'stats'; items: StatItem[] }
  | { kind: 'figure'; figure: FigureBlock }

const FIGURE_KEYS = new Set(['title', 'dek', 'source', 'alt', 'width'])

// Explicit inert tag allowlist for ```figure blocks (SVG charts + layout wrappers).
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'pattern', 'clippath', 'lineargradient', 'radialgradient',
  'stop', 'title', 'desc', 'marker', 'use',
  'div', 'p', 'span', 'strong', 'em', 'br', 'img',
])

const FORBIDDEN_PATTERNS: Array<[RegExp, string]> = [
  [/<\s*(script|iframe|object|embed|foreignobject|style|link|meta|base|form|input|textarea|button|select|a)\b/i, 'forbidden element'],
  [/\bon[a-z]+\s*=/i, 'event handler attribute'],
  [/\b(?:javascript|vbscript)\s*:/i, 'script URI'],
  [/data\s*:\s*text\/html/i, 'html data URI'],
  [/@import\b/i, 'css @import'],
  [/\b(?:src|href|xlink:href)\s*=\s*["']?\s*(?:https?:)?\/\//i, 'external network reference'],
  [/url\(\s*["']?\s*(?:https?:)?\/\//i, 'external css url()'],
  [/<!--[\s\S]*?-->/g, ''], // handled by stripping comments before tag scan
]

/**
 * Validate and sanitize a ```figure graphic body.
 * Fail-closed: returns `{ ok: false, reason }` on any disallowed tag, event handler,
 * external URL, or invalid <use>/<img> reference. Never silently mutates a broken chart.
 */
export function sanitizeFigureMarkup(raw: string): { ok: true; markup: string } | { ok: false; reason: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'empty figure body' }

  // Strip HTML comments before scanning tags so a comment cannot hide markup or trip tag checks.
  const withoutComments = trimmed.replace(/<!--[\s\S]*?-->/g, '')

  for (const [rx, label] of FORBIDDEN_PATTERNS) {
    if (!label) continue
    const m = rx.exec(withoutComments)
    if (m) return { ok: false, reason: `${label}: ${m[0]}` }
  }

  // Verify every opening and closing tag is in the explicit allowlist.
  const tagRx = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g
  let match: RegExpExecArray | null
  let sawTag = false
  while ((match = tagRx.exec(withoutComments)) !== null) {
    sawTag = true
    const isClose = match[1] === '/'
    const tagName = match[2].toLowerCase()
    const attrs = match[3] || ''
    if (!ALLOWED_TAGS.has(tagName)) {
      return { ok: false, reason: `disallowed tag <${tagName}>` }
    }
    if (isClose) continue

    if (tagName === 'img') {
      const srcM = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs)
      const src = (srcM?.[1] ?? srcM?.[2] ?? '').trim()
      if (!/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(src)) {
        return { ok: false, reason: '<img> inside figure must use a base64 data:image/ URI' }
      }
    }

    if (tagName === 'use') {
      const hrefM = /\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs)
      const href = (hrefM?.[1] ?? hrefM?.[2] ?? '').trim()
      if (href && !href.startsWith('#')) {
        return { ok: false, reason: '<use> href must be a local #id reference' }
      }
    }

    // Check style="..." values for url() pointing outside same-doc #id
    const styleM = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs)
    const styleVal = styleM?.[1] ?? styleM?.[2] ?? ''
    if (styleVal) {
      const urlRx = /url\(\s*["']?([^"')]+)["']?\s*\)/gi
      let um: RegExpExecArray | null
      while ((um = urlRx.exec(styleVal)) !== null) {
        if (!um[1].trim().startsWith('#')) {
          return { ok: false, reason: `external url() in style: ${um[1]}` }
        }
      }
    }
  }

  if (!sawTag) {
    return { ok: false, reason: 'figure body contains no SVG or layout markup' }
  }

  // Reject unclosed / stray angle brackets that could confuse HTML parsing (<script without >)
  if (/<\s*script\b/i.test(withoutComments)) {
    return { ok: false, reason: 'forbidden script token' }
  }

  return { ok: true, markup: withoutComments }
}

export function parseStatsBlock(body: string): StatItem[] {
  const items: StatItem[] = []
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const parts = line.split('|').map((s) => s.trim())
    if (!parts[0]) continue
    items.push({
      value: parts[0],
      label: parts[1] ?? '',
      context: parts[2] ?? '',
    })
  }
  return items
}

export function parseFigureBlock(body: string): FigureBlock {
  const lines = body.split(/\r?\n/)
  const meta: Record<string, string> = {}
  let k = 0
  while (k < lines.length) {
    const ln = lines[k].trim()
    if (!ln) {
      k++
      break
    }
    if (ln.startsWith('<')) break
    const m = /^([a-z]+)\s*:\s*(.*)$/.exec(ln)
    if (!m || !FIGURE_KEYS.has(m[1])) break
    meta[m[1]] = m[2].trim()
    k++
  }
  const graphic = lines.slice(k).join('\n').trim()
  const title = meta.title ?? ''
  const dek = meta.dek ?? ''
  const source = meta.source ?? ''
  const alt = meta.alt ?? ''
  const wide = (meta.width ?? '').toLowerCase() === 'wide'

  if (!graphic) {
    return { title, dek, source, alt, wide, markup: null, error: 'empty figure body' }
  }
  if (!alt) {
    return { title, dek, source, alt, wide, markup: null, error: 'figure missing required alt: line' }
  }
  const checked = sanitizeFigureMarkup(graphic)
  if (!checked.ok) {
    return { title, dek, source, alt, wide, markup: null, error: checked.reason }
  }
  return { title, dek, source, alt, wide, markup: checked.markup, error: null }
}

/**
 * Split a markdown document into alternating prose (`markdown`), `stats`, and
 * `figure` segments while respecting ordinary fenced code blocks (so a
 * ```figure example inside a ````markdown fence is left untouched).
 */
export function splitEditorialBlocks(md: string): EditorialSegment[] {
  const lines = md.split(/\r?\n/)
  const out: EditorialSegment[] = []
  let mdBuf: string[] = []

  const flushMd = () => {
    const text = mdBuf.join('\n')
    if (text.trim().length > 0) out.push({ kind: 'markdown', text })
    mdBuf = []
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const open = /^([ \t]{0,3})(`{3,}|~{3,})([^\n]*)$/.exec(line)
    if (!open) {
      mdBuf.push(line)
      i++
      continue
    }

    const fence = open[2]
    const fenceChar = fence[0]
    const fenceLen = fence.length
    const info = open[3].trim().toLowerCase()

    // Find matching closing fence
    const closeRx = new RegExp(`^[ \\t]{0,3}${fenceChar}{${fenceLen},}[ \\t]*$`)
    let j = i + 1
    while (j < lines.length && !closeRx.test(lines[j])) j++

    const closed = j < lines.length
    if (closed && (info === 'figure' || info === 'stats')) {
      flushMd()
      const inner = lines.slice(i + 1, j).join('\n')
      if (info === 'stats') {
        const items = parseStatsBlock(inner)
        if (items.length > 0) out.push({ kind: 'stats', items })
      } else {
        out.push({ kind: 'figure', figure: parseFigureBlock(inner) })
      }
      i = j + 1
      continue
    }

    // Ordinary code fence (or unclosed fence): keep verbatim in markdown buffer.
    const end = closed ? j + 1 : lines.length
    for (let t = i; t < end; t++) mdBuf.push(lines[t])
    i = end
  }

  flushMd()
  return out
}

// ── remark plugin: ==highlight== -> <mark>, safe <sup>/<sub>, numeric table cells ──

const NUMERIC_CELL_RX =
  /^[-+\u2212~\u2248]?[$\u20ac\u00a3\u20b9]?\d[\d,.]*\s?(%|\u00d7|x|k|K|M|B|ms|s|pp|h|d)?$/

const INLINE_TOKEN_RX =
  /==(?=\S)([^=\n]+?)(?<=\S)==|<(sup|sub)>([^<>\n]{1,32})<\/\2>/g

interface MdastNode {
  type: string
  value?: string
  children?: MdastNode[]
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

function textOf(node: MdastNode): string {
  if (typeof node.value === 'string') return node.value
  if (!Array.isArray(node.children)) return ''
  return node.children.map(textOf).join('')
}

function splitInlineTokens(text: string): MdastNode[] | null {
  INLINE_TOKEN_RX.lastIndex = 0
  let match: RegExpExecArray | null
  let last = 0
  const nodes: MdastNode[] = []

  while ((match = INLINE_TOKEN_RX.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push({ type: 'text', value: text.slice(last, match.index) })
    }
    if (match[1] !== undefined) {
      nodes.push({
        type: 'editorialMark',
        data: { hName: 'mark' },
        children: [{ type: 'text', value: match[1] }],
      })
    } else if (match[2] && match[3] !== undefined) {
      nodes.push({
        type: 'editorialScript',
        data: { hName: match[2] },
        children: [{ type: 'text', value: match[3] }],
      })
    }
    last = match.index + match[0].length
  }

  if (nodes.length === 0) return null
  if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) })
  return nodes
}

function transformTree(node: MdastNode): void {
  if (node.type === 'code' || node.type === 'inlineCode') return

  if (node.type === 'tableCell') {
    const raw = textOf(node).trim()
    if (NUMERIC_CELL_RX.test(raw)) {
      node.data = node.data || {}
      node.data.hProperties = { ...(node.data.hProperties || {}), className: ['num'] }
    }
  }

  if (!Array.isArray(node.children)) return
  const next: MdastNode[] = []
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    // remark-parse emits inline <sup>...</sup> and <sub>...</sub> as three sibling nodes:
    // html("<sup>") + text("10") + html("</sup>"). Convert safe short pairs into real sup/sub.
    if (
      child.type === 'html' &&
      (child.value === '<sup>' || child.value === '<sub>') &&
      i + 2 < node.children.length
    ) {
      const mid = node.children[i + 1]
      const end = node.children[i + 2]
      const tag = child.value.slice(1, -1)
      if (
        mid.type === 'text' &&
        typeof mid.value === 'string' &&
        mid.value.length > 0 &&
        mid.value.length <= 32 &&
        end.type === 'html' &&
        end.value === `</${tag}>`
      ) {
        next.push({
          type: 'editorialScript',
          data: { hName: tag },
          children: [{ type: 'text', value: mid.value }],
        })
        i += 2
        continue
      }
    }
    if (child.type === 'text' && typeof child.value === 'string') {
      const replaced = splitInlineTokens(child.value)
      if (replaced) {
        next.push(...replaced)
        continue
      }
    } else {
      transformTree(child)
    }
    next.push(child)
  }
  node.children = next
}

/**
 * Remark plugin that adds `editorial-report` inline syntax without enabling
 * rehype-raw:
 *  - `==highlight==` -> `<mark>`
 *  - short plain `<sup>...</sup>` / `<sub>...</sub>` -> real superscript/subscript
 *  - numeric-only GFM table cells -> `class="num"` (right-aligned tabular figures)
 */
export function remarkEditorialInline() {
  return (tree: MdastNode) => {
    transformTree(tree)
  }
}
