// Aura empty state — display headline + lede + optional action.
import { type ReactNode } from 'react'

interface EmptyStateProps {
  headline: string
  italic?: string       // optional italic phrase appended to headline (one soft beat)
  subtext?: string
  action?: ReactNode
}

export function EmptyState({ headline, italic, subtext, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-4)',
        textAlign: 'center',
        padding: 'var(--sp-16) var(--sp-6)',
      }}
    >
      <h1
        style={{
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 300,
          lineHeight: 'var(--lh-h1)',
          letterSpacing: 'var(--tracking-display)',
          color: 'var(--fg)',
          maxWidth: '24ch',
        }}
      >
        {headline}
        {italic && (
          <>
            {' '}
            <em style={{ fontWeight: 200, fontStyle: 'italic', color: 'var(--fg-muted)' }}>
              {italic}
            </em>
          </>
        )}
      </h1>
      {subtext && (
        <p
          style={{
            fontSize: 'var(--text-body)',
            color: 'var(--fg-muted)',
            lineHeight: 'var(--lh-body)',
            maxWidth: '50ch',
          }}
        >
          {subtext}
        </p>
      )}
      {action && <div style={{ marginTop: 'var(--sp-4)' }}>{action}</div>}
    </div>
  )
}
