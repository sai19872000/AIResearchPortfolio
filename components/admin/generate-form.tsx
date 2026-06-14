'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Upload, X, FileText } from 'lucide-react'

type Ref = { title: string | null; url: string | null; text: string }

export function GenerateForm() {
  const router = useRouter()
  const [topic, setTopic] = useState('')
  const [angle, setAngle] = useState('')
  const [urls, setUrls] = useState('')
  const [tone, setTone] = useState('')
  const [length, setLength] = useState('standard')
  const [pdfs, setPdfs] = useState<Ref[]>([])
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setMsg('')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) setPdfs((p) => [...p, { title: data.title, url: null, text: data.text }])
    else setMsg(data.error || 'Upload failed')
    setUploading(false)
    e.target.value = ''
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setBusy(true); setMsg('')
    const res = await fetch('/api/admin/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic, angle,
        referenceUrls: urls.split('\n').map((u) => u.trim()).filter(Boolean),
        references: pdfs,
        options: { tone, length },
      }),
    })
    const data = await res.json()
    setBusy(false)
    if (res.ok) {
      setTopic(''); setAngle(''); setUrls(''); setTone(''); setPdfs([])
      setMsg('Queued. The writer will pick it up and a draft will appear below.')
      router.refresh()
    } else setMsg(data.error || 'Could not queue')
  }

  return (
    <form onSubmit={submit} className="au-card au-card--accent au-card--seam" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <label className="au-field">
        <span className="au-field__label">Topic / idea *</span>
        <textarea className="au-input" rows={2} value={topic} onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Why small fine-tuned models beat frontier APIs for narrow production tasks" required style={{ resize: 'vertical' }} />
      </label>
      <label className="au-field">
        <span className="au-field__label">Angle / notes (optional)</span>
        <textarea className="au-input" rows={2} value={angle} onChange={(e) => setAngle(e.target.value)}
          placeholder="Key points to hit, audience, your take…" style={{ resize: 'vertical' }} />
      </label>
      <label className="au-field">
        <span className="au-field__label">Reference URLs (one per line)</span>
        <textarea className="au-input" rows={2} value={urls} onChange={(e) => setUrls(e.target.value)}
          placeholder="https://arxiv.org/abs/…" style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 13 }} />
      </label>

      <div className="au-field">
        <span className="au-field__label">Reference PDFs</span>
        <div className="flex flex-wrap items-center gap-2">
          {pdfs.map((p, i) => (
            <span key={i} className="au-chip" style={{ textTransform: 'none', letterSpacing: 0, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <FileText size={12} /> {p.title}
              <button type="button" onClick={() => setPdfs((x) => x.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'inline-flex' }}><X size={12} /></button>
            </span>
          ))}
          <label className="au-btn au-btn--secondary au-btn--sm" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> {uploading ? 'Reading…' : 'Add PDF'}
            <input type="file" accept="application/pdf" onChange={onPdf} hidden disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="au-field">
          <span className="au-field__label">Tone (optional)</span>
          <input className="au-input" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="technical, plain, opinionated…" />
        </label>
        <label className="au-field">
          <span className="au-field__label">Length</span>
          <select className="au-input" value={length} onChange={(e) => setLength(e.target.value)}>
            <option value="short">Short (~600 words)</option>
            <option value="standard">Standard (~1000 words)</option>
            <option value="deep">Deep (~1800 words)</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" className="au-btn au-btn--primary" disabled={busy || uploading} style={{ opacity: busy ? 0.7 : 1 }}>
          <Sparkles size={16} /> {busy ? 'Queuing…' : 'Generate draft'}
        </button>
        {msg && <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{msg}</span>}
      </div>
    </form>
  )
}
