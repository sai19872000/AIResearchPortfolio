'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { List, X, ArrowDown } from '@phosphor-icons/react'

const LINKS = [
  { label: 'about', href: '/#about' },
  { label: 'work', href: '/#work' },
  { label: 'writing', href: '/blog' },
  { label: 'contact', href: '/#contact' },
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

  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        background: scrolled ? 'rgba(10,14,26,0.72)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'background var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard)',
      }}
    >
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-sm"
          style={{ color: 'var(--fg)', textDecoration: 'none', letterSpacing: 'var(--tracking-display)' }}
        >
          sai teja pusuluri
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm"
              style={{ color: 'var(--fg-muted)', textDecoration: 'none', transition: 'color var(--duration-fast) var(--ease-standard)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-muted)')}
            >
              {l.label}
            </Link>
          ))}
          <a href="/assets/resume.pdf" target="_blank" rel="noreferrer" className="link-arrow">
            cv <ArrowDown size={13} weight="bold" />
          </a>
        </div>

        <button
          className="md:hidden"
          aria-label={open ? 'close menu' : 'open menu'}
          onClick={() => setOpen((v) => !v)}
          style={{ color: 'var(--fg)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          {open ? <X size={20} /> : <List size={20} />}
        </button>
      </nav>

      {open && (
        <div
          className="md:hidden"
          style={{ background: 'rgba(10,14,26,0.95)', borderTop: '1px solid var(--border)' }}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-4">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-2 text-sm"
                style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}
              >
                {l.label}
              </Link>
            ))}
            <a href="/assets/resume.pdf" target="_blank" rel="noreferrer" className="link-arrow py-2">
              cv <ArrowDown size={13} weight="bold" />
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
