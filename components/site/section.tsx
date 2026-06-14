import type { ReactNode } from 'react'
import { Reveal } from './reveal'

/** Editorial section: mono seam-tick label + Fraunces heading, hairline top rule. */
export function Section({
  id,
  index,
  eyebrow,
  title,
  intro,
  children,
  divider = true,
}: {
  id?: string
  index: string
  eyebrow: string
  title: ReactNode
  intro?: ReactNode
  children: ReactNode
  divider?: boolean
}) {
  return (
    <section
      id={id}
      className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28"
      style={{ scrollMarginTop: 96, borderTop: divider ? '1px solid var(--line)' : undefined }}
    >
      <Reveal>
        <div className="mb-12 md:mb-16">
          <span className="t-label seam-tick">{index} · {eyebrow}</span>
          <h2
            className="mt-4 max-w-3xl"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.75rem, 3.6vw, 2.5rem)',
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: 'var(--tracking-display)',
              color: 'var(--text)',
            }}
          >
            {title}
          </h2>
          {intro && (
            <p className="mt-5 measure" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body-lg, 19px)' }}>
              {intro}
            </p>
          )}
        </div>
      </Reveal>
      {children}
    </section>
  )
}
