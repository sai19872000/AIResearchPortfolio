'use client'
import { useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'

type State = 'idle' | 'sending' | 'sent' | 'error'

const field: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-md)',
  padding: '12px 14px',
  color: 'var(--fg)',
  fontSize: 'var(--text-small)',
  fontFamily: 'var(--font-primary)',
  outline: 'none',
  transition: 'border-color var(--duration-fast) var(--ease-standard)',
}
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  letterSpacing: 'var(--tracking-mono)',
  textTransform: 'uppercase',
  color: 'var(--fg-dim)',
  display: 'block',
  marginBottom: 'var(--sp-2)',
}

export function ContactForm() {
  const [state, setState] = useState<State>('idle')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries())
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('bad status')
      setState('sent')
      e.currentTarget.reset()
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-8)' }}>
        <p style={{ color: 'var(--fg)' }}>sent — <em>i&apos;ll get back to you</em>.</p>
        <button
          onClick={() => setState('idle')}
          className="link-arrow"
          style={{ marginTop: 'var(--sp-4)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          send another →
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <label style={labelStyle} htmlFor="name">name</label>
        <input style={field} id="name" name="name" required autoComplete="name"
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')} />
      </div>
      <div>
        <label style={labelStyle} htmlFor="email">email</label>
        <input style={field} id="email" name="email" type="email" required autoComplete="email"
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')} />
      </div>
      <div>
        <label style={labelStyle} htmlFor="message">message</label>
        <textarea style={{ ...field, minHeight: 130, resize: 'vertical' }} id="message" name="message" required
          placeholder="tell me about the work…"
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')} />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={state === 'sending'}
          className="link-arrow"
          style={{ background: 'none', border: 'none', cursor: state === 'sending' ? 'default' : 'pointer', fontSize: 'var(--text-body)', opacity: state === 'sending' ? 0.6 : 1 }}
        >
          {state === 'sending' ? 'sending…' : 'send message'} <ArrowRight size={15} weight="bold" />
        </button>
        {state === 'error' && (
          <span className="text-sm" style={{ color: 'var(--danger)' }}>something didn&apos;t send. retry?</span>
        )}
      </div>
    </form>
  )
}
