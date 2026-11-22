import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  remarkEditorialInline,
  splitEditorialBlocks,
  type FigureBlock,
  type StatItem,
} from '@/lib/editorial'

/**
 * Render simple inline formatting (`**bold**`, `*italic*`, `` `code` ``,
 * `==highlight==`) for figure titles, deks, sources, and stat cells without
 * using dangerouslySetInnerHTML.
 */
function InlineEditorialText({ text }: { text: string }) {
  const rx = /(\*\*[^*]+\*\*|==(?=\S)[^=\n]+?(?<=\S)==|`[^`]+`|\*[^*\n]+\*)/g
  const parts = text.split(rx)
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={idx}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
          return <mark key={idx}>{part.slice(2, -2)}</mark>
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return <code key={idx}>{part.slice(1, -1)}</code>
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={idx}>{part.slice(1, -1)}</em>
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>
      })}
    </>
  )
}

function StatsStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="ed-stats">
      {items.map((item, i) => (
        <div key={i} className="ed-stat">
          <span className="n"><InlineEditorialText text={item.value} /></span>
          {item.label && <span className="l"><InlineEditorialText text={item.label} /></span>}
          {item.context && <span className="c"><InlineEditorialText text={item.context} /></span>}
        </div>
      ))}
    </div>
  )
}

function EditorialFigure({ figure }: { figure: FigureBlock }) {
  const cls = figure.wide ? 'ed-figure ed-wide' : 'ed-figure'
  return (
    <figure className={cls}>
      {figure.title && (
        <p className="ed-fig-title">
          <InlineEditorialText text={figure.title} />
        </p>
      )}
      {figure.dek && (
        <p className="ed-fig-dek">
          <InlineEditorialText text={figure.dek} />
        </p>
      )}
      {figure.markup ? (
        <div
          className="ed-fig-body"
          role="img"
          aria-label={figure.alt}
          // Markup has passed lib/editorial.ts's strict inert SVG/layout allowlist.
          dangerouslySetInnerHTML={{ __html: figure.markup }}
        />
      ) : (
        <div className="ed-fig-fallback" role="note">
          {figure.alt || 'Figure unavailable.'}
        </div>
      )}
      {figure.source && (
        <figcaption className="ed-fig-source">
          <InlineEditorialText text={figure.source} />
        </figcaption>
      )}
    </figure>
  )
}

/**
 * Renders post markdown with the Auracle prose + Pudding editorial-report layer
 * (`app/globals.css` `.prose.ed`). Supports GFM tables/lists, `==highlight==`
 * marks, safe `<sup>`/`<sub>`, `stats` strips, and strictly-sanitized inert SVG
 * `figure` blocks. Raw HTML remains disabled in prose (no rehype-raw).
 */
export function Markdown({ children }: { children: string }) {
  const segments = splitEditorialBlocks(children)
  return (
    <div className="prose ed">
      {segments.map((seg, i) => {
        if (seg.kind === 'stats') return <StatsStrip key={i} items={seg.items} />
        if (seg.kind === 'figure') return <EditorialFigure key={i} figure={seg.figure} />
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm, remarkEditorialInline]}>
            {seg.text}
          </ReactMarkdown>
        )
      })}
    </div>
  )
}
