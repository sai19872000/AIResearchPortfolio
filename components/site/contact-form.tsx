'use client'
import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'

type State = 'idle' | 'sending' | 'sent' | 'error'

export function ContactForm() {
  const [state, setState] = useState<State>('idle')
  // Render-time stamp: the server rejects submissions faster than a human can type.
  const renderedAt = useRef(Date.now())

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // React nulls event.currentTarget once the handler yields at its first `await`,
    // so capture the form NOW. (Reading it after the fetch made every successful
    // send throw and render "Something didn't send".)
    const form = e.currentTarget
    setState('sending')
    const payload = Object.fromEntries(new FormData(form).entries())
    payload._t = String(renderedAt.current)
    let ok = false
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      ok = res.ok
    } catch {
      ok = false
    }
    if (!ok) {
      setState('error')
      return
    }
    // Reset BEFORE flipping to 'sent' and outside the fetch try/catch: a reset
    // problem must never be reported as a failed send.
    form.reset()
    setState('sent')
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
      {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
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
        <textarea className="au-input" name="message" required rows={5} maxLength={5000} placeholder="What are you working on?" style={{ resize: 'vertical', minHeight: 130 }} />
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
