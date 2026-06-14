import Link from 'next/link'
import { Mark } from '@/components/auracle/mark'

export function SiteFooter() {
  const col = (head: string, items: { label: string; href: string; ext?: boolean }[]) => (
    <div>
      <div className="t-label" style={{ marginBottom: 14 }}>{head}</div>
      {items.map((it) => (
        <div key={it.label} style={{ marginBottom: 9 }}>
          <a href={it.href} target={it.ext ? '_blank' : undefined} rel={it.ext ? 'noreferrer' : undefined}
            style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)' }}>{it.label}</a>
        </div>
      ))}
    </div>
  )
  return (
    <footer style={{ borderTop: '1px solid var(--line)', padding: '56px 24px 40px' }}>
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.6fr_1fr_1fr]" >
        <div>
          <Mark size={28} withWord />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-faint)', maxWidth: 300, marginTop: 16, lineHeight: 1.6 }}>
            Generative and agentic AI, built to hold up in production. Lewis Center, Ohio.
          </p>
        </div>
        {col('Elsewhere', [
          { label: 'LinkedIn', href: 'https://www.linkedin.com/in/sai-teja-pusuluri/', ext: true },
          { label: 'GitHub', href: 'https://github.com/sai19872000', ext: true },
          { label: 'Google Scholar', href: 'https://scholar.google.com/citations?user=P2w4iY4AAAAJ&hl=en', ext: true },
        ])}
        {col('Site', [
          { label: 'Writing', href: '/blog' },
          { label: 'Résumé', href: '/assets/resume.pdf', ext: true },
          { label: 'Contact', href: '/#contact' },
        ])}
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl items-center justify-between" style={{ paddingTop: 22, borderTop: '1px solid var(--line)' }}>
        <span className="t-label" style={{ letterSpacing: '.06em' }}>© {new Date().getFullYear()} SAI TEJA PUSULURI</span>
        <span className="t-label" style={{ letterSpacing: '.06em' }}>FORGED IN AURACLE</span>
      </div>
    </footer>
  )
}
