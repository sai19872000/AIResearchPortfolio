import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight } from '@phosphor-icons/react/dist/ssr'
import { getPost, getReferences } from '@/lib/firestore'
import { Markdown } from '@/components/site/markdown'
import { ThemeChip } from '@/components/aura/theme-chip'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'not found' }
  return {
    title: post.title,
    description: post.summary || undefined,
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.summary || undefined,
      publishedTime: post.publishedAt || undefined,
      images: post.heroImage ? [post.heroImage] : undefined,
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
    <article className="mx-auto w-full max-w-3xl px-6 pb-24 pt-32">
      <Link className="link-arrow" href="/blog">
        <ArrowLeft size={14} weight="bold" /> writing
      </Link>

      <header className="mt-10">
        <div className="text-xs" style={{ color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
          {formatDate(post.publishedAt, { month: 'long' })}
          {post.readTime ? ` · ${post.readTime} min read` : ''}
        </div>
        <h1
          className="mt-4"
          style={{ fontSize: 'clamp(1.9rem,4.5vw,3rem)', fontWeight: 300, letterSpacing: 'var(--tracking-display)', lineHeight: 'var(--lh-h1)', color: 'var(--fg)' }}
        >
          {post.title}
        </h1>
        {post.summary && (
          <p className="mt-5" style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-h3)', lineHeight: 'var(--lh-h3)' }}>
            {post.summary}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {post.tags.map((t) => <ThemeChip key={t} label={t} />)}
        </div>
      </header>

      {post.heroImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.heroImage}
          alt={post.title}
          className="mt-10 w-full"
          style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border)' }}
        />
      )}

      <div className="mt-12" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-12)' }}>
        <Markdown>{post.content}</Markdown>
      </div>

      {references.length > 0 && (
        <section className="mt-16" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-8)' }}>
          <span className="eyebrow">references</span>
          <ol className="mt-6 space-y-4">
            {references.map((r, i) => (
              <li key={r.id} className="flex gap-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
                <span style={{ color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="link-arrow" style={{ display: 'inline' }}>
                      {r.title || r.originalFileName || r.url} <ArrowUpRight size={12} weight="bold" />
                    </a>
                  ) : (
                    <span style={{ color: 'var(--fg)' }}>{r.title || r.originalFileName}</span>
                  )}
                  {r.contentSummary && <span className="block mt-1" style={{ color: 'var(--fg-dim)' }}>{r.contentSummary}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-16 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-8)' }}>
        <Link className="link-arrow" href="/blog"><ArrowLeft size={14} weight="bold" /> all writing</Link>
        <Link className="link-arrow" href="/#contact">get in touch →</Link>
      </footer>
    </article>
  )
}
