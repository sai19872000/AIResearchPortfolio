import type { ReactNode } from 'react'
import { Reveal } from './reveal'

/** Editorial section: mono eyebrow + restrained heading, hairline top rule. */
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
      className="mx-auto w-full max-w-5xl px-6 py-20 md:py-28 scroll-mt-24"
      style={divider ? { borderTop: '1px solid var(--border)' } : undefined}
    >
      <Reveal>
        <div className="mb-12 md:mb-16">
          <span className="eyebrow">
            {index} / {eyebrow}
          </span>
          <h2
            className="mt-4 max-w-3xl"
            style={{
              fontSize: 'clamp(1.6rem, 3.4vw, 2.4rem)',
              fontWeight: 300,
              lineHeight: 'var(--lh-h2)',
              letterSpacing: 'var(--tracking-display)',
              color: 'var(--fg)',
            }}
          >
            {title}
          </h2>
          {intro && (
            <p className="mt-5 measure" style={{ color: 'var(--fg-muted)' }}>
              {intro}
            </p>
          )}
        </div>
      </Reveal>
      {children}
    </section>
  )
}
