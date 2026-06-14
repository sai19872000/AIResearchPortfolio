import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowRight, ArrowDown } from '@phosphor-icons/react/dist/ssr'
import { AuraMark } from '@/components/aura/aura-mark'
import type { Portfolio } from '@/lib/types'

const d = (ms: number): CSSProperties => ({ ['--d' as string]: `${ms}ms` })

export function Hero({ portfolio }: { portfolio: Portfolio }) {
  const { personal, education } = portfolio
  const stats = [
    { k: '8+', v: 'years in industry AI' },
    { k: 'phd', v: 'physics · neural networks' },
    { k: '4', v: 'peer-reviewed papers' },
  ]

  return (
    <section className="relative mx-auto flex min-h-[92vh] max-w-5xl flex-col justify-center px-6 pb-20 pt-32">
      <div className="load-up mb-8 flex items-center gap-3" style={d(0)}>
        <AuraMark size={20} />
        <span className="eyebrow">generative ai · agentic systems · mlops</span>
      </div>

      <h1
        className="load-up"
        style={{
          ...d(80),
          fontSize: 'clamp(2.4rem, 6.5vw, 4.6rem)',
          fontWeight: 300,
          lineHeight: 'var(--lh-h1)',
          letterSpacing: 'var(--tracking-display)',
          color: 'var(--fg)',
          maxWidth: '18ch',
        }}
      >
        i build generative and agentic systems that hold up in production, <em>quietly forged</em>.
      </h1>

      <p className="load-up mt-8 measure" style={{ ...d(160), color: 'var(--fg-muted)' }}>
        {personal.bio}
      </p>

      <div className="load-up mt-10 flex flex-wrap items-center gap-x-8 gap-y-4" style={d(240)}>
        <Link className="link-arrow" href="/#contact" style={{ fontSize: 'var(--text-body)' }}>
          get in touch <ArrowRight size={15} weight="bold" />
        </Link>
        <a className="link-arrow" href="/assets/resume.pdf" target="_blank" rel="noreferrer" style={{ fontSize: 'var(--text-body)' }}>
          download cv <ArrowDown size={15} weight="bold" />
        </a>
        <Link className="link-arrow" href="/blog" style={{ fontSize: 'var(--text-body)' }}>
          read the writing <ArrowRight size={15} weight="bold" />
        </Link>
      </div>

      <dl
        className="load-up mt-16 grid max-w-2xl grid-cols-3 gap-px"
        style={{ ...d(320), borderTop: '1px solid var(--border)' }}
      >
        {stats.map((s) => (
          <div key={s.k} className="pt-5">
            <dt style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 300, color: 'var(--fg)', letterSpacing: 'var(--tracking-display)' }}>
              {s.k}
            </dt>
            <dd className="mt-1 text-xs" style={{ color: 'var(--fg-dim)' }}>{s.v}</dd>
          </div>
        ))}
      </dl>

      <span className="sr-only">
        {personal.name}, {personal.title}. {education.degree}, {education.institution}.
      </span>
    </section>
  )
}
