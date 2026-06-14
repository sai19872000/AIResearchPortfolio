'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X, ArrowDown } from 'lucide-react'
import { Mark } from '@/components/auracle/mark'

const LINKS = [
  { label: 'About', href: '/#about' },
  { label: 'Work', href: '/#work' },
  { label: 'Writing', href: '/blog' },
  { label: 'Contact', href: '/#contact' },
]

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const link: React.CSSProperties = {
    fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)',
    textDecoration: 'none', transition: 'color var(--dur-fast) var(--ease-out)',
  }

  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        background: scrolled ? 'color-mix(in srgb, var(--bg) 82%, transparent)' : 'transparent',
        backdropFilter: scrolled ? 'blur(8px)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'var(--line)' : 'transparent'}`,
        transition: 'background var(--dur-base) var(--ease-out), border-color var(--dur-base)',
      }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="Sai Teja Pusuluri — home"><Mark size={26} withWord /></Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} style={link}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
              {l.label}
            </Link>
          ))}
          <a href="/assets/resume.pdf" target="_blank" rel="noreferrer" className="au-btn au-btn--secondary au-btn--sm">
            CV <ArrowDown size={14} />
          </a>
        </div>

        <button className="md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)}
          style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden" style={{ background: 'color-mix(in srgb, var(--bg) 96%, transparent)', borderTop: '1px solid var(--line)' }}>
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2" style={link}>{l.label}</Link>
            ))}
            <a href="/assets/resume.pdf" target="_blank" rel="noreferrer" className="link-arrow py-2">CV <ArrowDown size={14} /></a>
          </div>
        </div>
      )}
    </header>
  )
}
