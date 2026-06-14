'use client'
// Aura card — the standard plate. Mono crumb above title, hairline border,
// no drop shadow at rest; on hover the border thickens to accent.
import { type ReactNode } from 'react'

interface CardWithMetaProps {
  title: string
  crumb?: string         // mono label above the title (e.g. "build · 4128")
  meta?: ReactNode
  cover?: ReactNode
  actions?: ReactNode
  href?: string
}

const cardStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 'var(--sp-3)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)',
  padding: 'var(--sp-6)',
  textDecoration: 'none',
  transition: `border-color var(--duration-base) var(--ease-standard),
               background var(--duration-base) var(--ease-standard)`,
}

function handleMouseEnter(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget as HTMLElement
  el.style.borderColor = 'var(--accent)'
  el.style.background = 'var(--surface-raised)'
}

function handleMouseLeave(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget as HTMLElement
  el.style.borderColor = 'var(--border)'
  el.style.background = 'var(--surface)'
}

export function CardWithMeta({ title, crumb, meta, cover, actions, href }: CardWithMetaProps) {
  const content = (
    <>
      {cover && <div>{cover}</div>}
      {crumb && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            letterSpacing: 'var(--tracking-mono)',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          ◐ {crumb}
        </span>
      )}
      <h3
        style={{
          fontSize: 'var(--text-h3)',
          fontWeight: 400,
          lineHeight: 'var(--lh-h3)',
          letterSpacing: 'var(--tracking-display)',
          color: 'var(--fg)',
          flex: 1,
        }}
      >
        {title}
      </h3>
      {meta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {meta}
        </div>
      )}
      {actions && <div>{actions}</div>}
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        aria-label={title}
        style={cardStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {content}
      </a>
    )
  }

  return (
    <div
      style={cardStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {content}
    </div>
  )
}