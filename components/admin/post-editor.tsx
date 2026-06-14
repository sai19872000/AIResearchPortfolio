'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Save, Trash2, ExternalLink } from 'lucide-react'
import type { BlogPost } from '@/lib/types'

export function PostEditor({ post, isNew }: { post: Partial<BlogPost>; isNew: boolean }) {
  const router = useRouter()
  const [f, setF] = useState({
    slug: post.slug || '',
    title: post.title || '',
    summary: post.summary || '',
    tags: (post.tags || []).join(', '),
    content: post.content || '',
    heroImage: post.heroImage || '',
    readTime: post.readTime || 0,
    published: !!post.published,
    publishedAt: post.publishedAt || '',
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k: keyof typeof f, v: unknown) => setF((s) => ({ ...s, [k]: v }))

  async function save() {
    setBusy(true); setMsg('')
    const body = {
      slug: f.slug.trim(),
      title: f.title,
      summary: f.summary,
      tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
      content: f.content,
      heroImage: f.heroImage || null,
      readTime: Number(f.readTime) || null,
      published: f.published,
      publishedAt: f.published ? (f.publishedAt || new Date().toISOString()) : f.publishedAt || null,
    }
    const res = await fetch('/api/admin/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    setBusy(false)
    if (res.ok) { setMsg('Saved.'); if (isNew) router.replace(`/admin/posts/${data.slug}`); router.refresh() }
    else setMsg(data.error || 'Save failed')
  }

  async function remove() {
    if (!confirm('Delete this post permanently?')) return
    setBusy(true)
    await fetch(`/api/admin/posts?slug=${encodeURIComponent(f.slug)}`, { method: 'DELETE' })
    router.replace('/admin'); router.refresh()
  }

  const labelStyle = 'au-field'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link className="link-arrow" href="/admin">← Back</Link>
        <div className="flex items-center gap-3">
          {!isNew && <a className="link-arrow" href={`/blog/${f.slug}`} target="_blank" rel="noreferrer">View <ExternalLink size={13} /></a>}
          {!isNew && <button onClick={remove} className="au-btn au-btn--secondary au-btn--sm" disabled={busy} style={{ color: 'var(--danger)' }}><Trash2 size={14} /> Delete</button>}
          <button onClick={save} className="au-btn au-btn--primary au-btn--sm" disabled={busy}><Save size={14} /> {busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <label className={labelStyle}>
        <span className="au-field__label">Title</span>
        <input className="au-input" value={f.title} onChange={(e) => set('title', e.target.value)} style={{ fontFamily: 'var(--font-display)', fontSize: 20 }} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelStyle}>
          <span className="au-field__label">Slug</span>
          <input className="au-input" value={f.slug} onChange={(e) => set('slug', e.target.value)} disabled={!isNew}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13, opacity: isNew ? 1 : 0.6 }} />
        </label>
        <label className={labelStyle}>
          <span className="au-field__label">Read time (min)</span>
          <input className="au-input" type="number" value={f.readTime} onChange={(e) => set('readTime', e.target.value)} />
        </label>
      </div>

      <label className={labelStyle}>
        <span className="au-field__label">Summary</span>
        <textarea className="au-input" rows={2} value={f.summary} onChange={(e) => set('summary', e.target.value)} style={{ resize: 'vertical' }} />
      </label>

      <label className={labelStyle}>
        <span className="au-field__label">Tags (comma-separated)</span>
        <input className="au-input" value={f.tags} onChange={(e) => set('tags', e.target.value)} />
      </label>

      <label className={labelStyle}>
        <span className="au-field__label">Hero image path</span>
        <input className="au-input" value={f.heroImage} onChange={(e) => set('heroImage', e.target.value)}
          placeholder="/art/blog/<slug>-hero.png" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
      </label>

      <label className={labelStyle}>
        <span className="au-field__label">Content (markdown)</span>
        <textarea className="au-input" rows={24} value={f.content} onChange={(e) => set('content', e.target.value)}
          style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6 }} />
      </label>

      <div className="flex items-center justify-between gap-4 py-2" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <label className="au-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <input type="checkbox" checked={f.published} onChange={(e) => set('published', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--cool)' }} />
          <span style={{ color: 'var(--text)', fontSize: 15 }}>Published {f.published ? '— live on /blog' : '— draft, hidden'}</span>
        </label>
        <button onClick={save} className="au-btn au-btn--primary au-btn--sm" disabled={busy}><Save size={14} /> {busy ? 'Saving…' : 'Save'}</button>
      </div>
      {msg && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{msg}</p>}
    </div>
  )
}
