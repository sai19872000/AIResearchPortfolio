import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPost, getReferences } from '@/lib/firestore'
import { verifyPreviewToken } from '@/lib/preview'
import { Markdown } from '@/components/site/markdown'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Draft preview', robots: { index: false } }

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { slug } = await params
  const { t } = await searchParams
  if (!verifyPreviewToken(slug, t)) notFound() // bad/absent token → 404, no leak

  const post = await getPost(slug)
  if (!post) notFound()
  const references = await getReferences(post.referenceIds)

  return (
    <article className="mx-auto w-full px-6 pb-24 pt-16" style={{ maxWidth: 'var(--maxw-prose)' }}>
      <div className="mb-8" style={{
        border: '1px solid var(--line-warm)', borderRadius: 'var(--radius-card)',
        padding: '10px 14px', background: 'rgba(242,168,91,.08)',
      }}>
        <span className="t-label" style={{ color: 'var(--warm)' }}>
          ◐ draft preview{post.published ? ' · published' : ' · not yet published'}
        </span>
      </div>

      <header>
        <div className="t-label" style={{ textTransform: 'none', letterSpacing: '.04em' }}>
          {post.publishedAt ? formatDate(post.publishedAt, { month: 'long' }) : 'draft'}
          {post.readTime ? ` · ${post.readTime} min read` : ''}
        </div>
        <h1 className="mt-4" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4.5vw,3rem)', fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.08, color: 'var(--text)' }}>
          {post.title}
        </h1>
        {post.summary && <p className="mt-5" style={{ color: 'var(--text-muted)', fontSize: 22, lineHeight: 1.4 }}>{post.summary}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          {post.tags.map((t) => <span key={t} className="au-chip">{t}</span>)}
        </div>
      </header>

      {post.heroImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.heroImage} alt="" className="mt-10 w-full" style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }} />
      )}

      <div className="mt-12" style={{ borderTop: '1px solid var(--line)', paddingTop: 48 }}>
        <Markdown>{post.content}</Markdown>
      </div>

      {references.length > 0 && (
        <section className="mt-16" style={{ borderTop: '1px solid var(--line)', paddingTop: 32 }}>
          <span className="t-label seam-tick">References</span>
          <ol className="mt-6 space-y-4">
            {references.map((r, i) => (
              <li key={r.id} className="flex gap-3" style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--cool)' }}>{r.title || r.url}</a> : (r.title || r.originalFileName)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  )
}
