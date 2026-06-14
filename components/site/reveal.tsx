import type { ReactNode, CSSProperties } from 'react'

/**
 * Page-load reveal — content rises 14px + fades once as it enters view
 * (auracle-rise). Pure CSS via a `view()` timeline, so it needs no JS and
 * degrades to fully visible (no-JS, reduced-motion, Safari). One per surface.
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
  delay?: number
}) {
  return (
    <Tag className={['reveal', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </Tag>
  )
}
