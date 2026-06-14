import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { getPost, getReferences } from '@/lib/firestore'
import { Markdown } from '@/components/site/markdown'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Not found' }
  return {
    title: post.title,
    description: post.summary || undefined,
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.summary || undefined,
      publishedTime: post.publishedAt || undefined,
      images: post.heroImage ? [post.heroImage] : ['/art/og.png'],
    },
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post || !post.published) notFound()

  const references = await getReferences(post.referenceIds)

  return (
    <article className="mx-auto w-full px-6 pb-24 pt-32" style={{ maxWidth: 'var(--maxw-prose)' }}>
      <Link className="link-arrow" href="/blog"><ArrowLeft size={14} /> Writing</Link>

      <header className="mt-10">
        <div className="t-label" style={{ textTransform: 'none', letterSpacing: '.04em' }}>
          {formatDate(post.publishedAt, { month: 'long' })}{post.readTime ? ` · ${post.readTime} min read` : ''}
        </div>
        <h1 className="mt-4" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4.5vw,3rem)', fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.08, color: 'var(--text)' }}>
          {post.title}
        </h1>
        {post.summary && <p className="mt-5" style={{ color: 'var(--text-muted)', fontSize: 22, lineHeight: 1.4 }}>{post.summary}</p>}
        <div className="mt-6 flex flex-wrap gap-2">{post.tags.map((t) => <span key={t} className="au-chip">{t}</span>)}</div>
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
                <span className="t-mono" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="link-arrow" style={{ display: 'inline' }}>
                      {r.title || r.originalFileName || r.url} <ArrowUpRight size={12} />
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text)' }}>{r.title || r.originalFileName}</span>
                  )}
                  {r.contentSummary && <span className="block" style={{ color: 'var(--text-faint)', marginTop: 4 }}>{r.contentSummary}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-16 flex items-center justify-between" style={{ borderTop: '1px solid var(--line)', paddingTop: 32 }}>
        <Link className="link-arrow" href="/blog"><ArrowLeft size={14} /> All writing</Link>
        <Link className="link-arrow" href="/#contact">Get in touch <ArrowUpRight size={14} /></Link>
      </footer>
    </article>
  )
}
