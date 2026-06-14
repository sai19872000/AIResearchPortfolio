import type { ReactNode, CSSProperties } from 'react'

/**
 * A quiet scroll-reveal: the surface fades up once as it enters the viewport.
 * Implemented in pure CSS (.reveal in globals.css via a `view()` timeline),
 * so it needs no JS and degrades to fully-visible everywhere it isn't
 * supported (no-JS, reduced-motion, Safari). One animation per surface.
 */
export function Reveal({
  children,
  className,
  as: Tag = 'div',
  style,
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'li' | 'article'
  style?: CSSProperties
  /** kept for call-site compatibility; CSS timeline ignores per-item delay */
  delay?: number
}) {
  return (
    <Tag className={['reveal', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </Tag>
  )
}
