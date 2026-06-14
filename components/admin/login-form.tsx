'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Mark } from '@/components/auracle/mark'

export function LoginForm() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    if (res.ok) {
      router.replace('/admin')
      router.refresh()
    } else {
      setErr('Wrong password.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-8 flex items-center gap-3"><Mark size={28} /><span className="t-label seam-tick">Admin</span></div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--text)' }}>
        Sign in.
      </h1>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <label className="au-field">
          <span className="au-field__label">Password</span>
          <input className="au-input" type="password" value={pw} autoFocus
            onChange={(e) => setPw(e.target.value)} />
        </label>
        <button type="submit" className="au-btn au-btn--primary" disabled={busy} style={{ opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Checking…' : 'Enter'} <ArrowRight size={16} />
        </button>
        {err && <span style={{ color: 'var(--danger)', fontSize: 14 }}>{err}</span>}
      </form>
    </div>
  )
}
