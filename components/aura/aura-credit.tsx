'use client'
// Aura made-by credit — the footer mark every factory app must carry.
//
// One of the four inheritance hooks. Drop this in the footer of any shipped
// app to carry the brand quietly. Pairs with the console signature
// (printed at app boot via /scripts/aura-boot.ts) to close the loop.
import { AuraMark } from './aura-mark'

interface AuraCreditProps {
  /** Defaults to https://saiteja.ai */
  href?: string
}

export function AuraCredit({ href = 'https://saiteja.ai' }: AuraCreditProps) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        letterSpacing: 'var(--tracking-mono)',
        textTransform: 'lowercase',
        color: 'var(--fg-dim)',
        textDecoration: 'none',
        transition: 'color var(--duration-fast) var(--ease-standard)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--fg-dim)' }}
    >
      <AuraMark size={14} state="still" />
      quietly forged at saiteja.ai
    </a>
  )
}