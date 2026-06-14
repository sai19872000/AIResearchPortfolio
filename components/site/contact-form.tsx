'use client'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

type State = 'idle' | 'sending' | 'sent' | 'error'

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
      <div className="au-card au-card--accent au-card--seam" style={{ padding: 28 }}>
        <p style={{ color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 22 }}>Message sent.</p>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>I read everything and reply when I can.</p>
        <button onClick={() => setState('idle')} className="link-arrow" style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
          Send another <ArrowRight size={14} />
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <label className="au-field">
        <span className="au-field__label">Name</span>
        <input className="au-input" name="name" required autoComplete="name" />
      </label>
      <label className="au-field">
        <span className="au-field__label">Email</span>
        <input className="au-input" name="email" type="email" required autoComplete="email" />
      </label>
      <label className="au-field">
        <span className="au-field__label">Message</span>
        <textarea className="au-input" name="message" required rows={5} placeholder="What are you working on?" style={{ resize: 'vertical', minHeight: 130 }} />
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={state === 'sending'} className="au-btn au-btn--primary" style={{ opacity: state === 'sending' ? 0.7 : 1 }}>
          {state === 'sending' ? 'Sending…' : 'Send message'} <ArrowRight size={16} />
        </button>
        {state === 'error' && <span style={{ color: 'var(--danger)', fontSize: 14 }}>Something didn’t send. Try again?</span>}
      </div>
    </form>
  )
}
