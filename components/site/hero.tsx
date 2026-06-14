import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowRight, ArrowDown } from 'lucide-react'
import type { Portfolio } from '@/lib/types'

const d = (ms: number): CSSProperties => ({ ['--d' as string]: `${ms}ms` })

export function Hero({ portfolio }: { portfolio: Portfolio }) {
  const { personal, education } = portfolio
  const stats = [
    { k: '8+', v: 'years building industry AI' },
    { k: 'PhD', v: 'physics · neural networks' },
    { k: '4', v: 'peer-reviewed papers' },
  ]

  return (
    <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="mx-auto grid max-w-6xl items-stretch gap-0 px-0 md:grid-cols-[1.04fr_.96fr]">
        {/* text column */}
        <div className="flex min-h-[88vh] flex-col justify-center px-6 py-28 md:pl-2 md:pr-12">
          <div className="rise" style={d(40)}>
            <span className="t-label seam-tick">Generative AI · agentic systems · MLOps</span>
          </div>
          <h1
            className="rise mt-6"
            style={{
              ...d(120),
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 'clamp(2.6rem, 6vw, 4rem)',
              lineHeight: 1.04,
              letterSpacing: '-.025em',
              color: 'var(--text)',
              maxWidth: '15ch',
            }}
          >
            I build AI that holds up in production.
          </h1>
          <p className="rise mt-7 measure" style={{ ...d(220), fontSize: 19, lineHeight: 1.55, color: 'var(--text-muted)' }}>
            {personal.bio}
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-3" style={d(320)}>
            <Link href="/#contact" className="au-btn au-btn--primary">Get in touch <ArrowRight size={17} /></Link>
            <a href="/assets/resume.pdf" target="_blank" rel="noreferrer" className="au-btn au-btn--secondary">Download CV <ArrowDown size={15} /></a>
          </div>
          <dl className="rise mt-12 grid max-w-xl grid-cols-3 gap-px" style={{ ...d(440), borderTop: '1px solid var(--line)' }}>
            {stats.map((s) => (
              <div key={s.k} className="pt-5">
                <dt style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem,3vw,2rem)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-.02em' }}>{s.k}</dt>
                <dd className="t-label" style={{ marginTop: 6, textTransform: 'none', letterSpacing: '.02em', color: 'var(--text-faint)' }}>{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* energy image column */}
        <div className="relative hidden md:block" style={{ minHeight: 560 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/hero.png" alt="" aria-hidden
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--bg) 0%, transparent 40%, transparent 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, var(--bg) 0%, transparent 24%)' }} />
        </div>
      </div>

      <span className="sr-only">{personal.name}, {personal.title}. {education.degree}, {education.institution}.</span>
    </section>
  )
}
