import Link from 'next/link'
import { AuraCredit } from '@/components/aura/aura-credit'

export function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)' }}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-14 md:flex-row md:items-end md:justify-between">
        <div className="max-w-sm">
          <p style={{ color: 'var(--fg)' }}>Sai Teja Pusuluri</p>
          <p className="mt-2 text-sm" style={{ color: 'var(--fg-dim)' }}>
            generative & agentic AI, built to hold up in production. lewis center, ohio.
          </p>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <a className="link-arrow" href="https://www.linkedin.com/in/sai-teja-pusuluri/" target="_blank" rel="noreferrer">linkedin →</a>
          <a className="link-arrow" href="https://github.com/sai19872000" target="_blank" rel="noreferrer">github →</a>
          <a className="link-arrow" href="https://scholar.google.com/citations?user=P2w4iY4AAAAJ&hl=en" target="_blank" rel="noreferrer">scholar →</a>
          <Link className="link-arrow" href="/blog">writing →</Link>
        </div>
      </div>

      <div
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs" style={{ color: 'var(--fg-dim)' }}>
          © {new Date().getFullYear()} Sai Teja Pusuluri
        </span>
        <AuraCredit />
      </div>
    </footer>
  )
}
