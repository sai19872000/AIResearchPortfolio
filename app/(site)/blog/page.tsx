import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { listPostsPage } from '@/lib/firestore'
import { Reveal } from '@/components/site/reveal'
import { yearMonth } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Writing',
  alternates: { canonical: '/blog', types: { 'application/rss+xml': '/blog/feed.xml' } },
  description:
    'Notes on generative AI, agentic systems, research, and the engineering behind them — by Sai Teja Pusuluri.',
}

export default async function BlogIndex({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const sp = await searchParams
  const { posts, page, pages, total } = await listPostsPage(parseInt(sp.page || '1', 10))

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-36">
      <Reveal>
        <span className="t-label seam-tick">Writing</span>
        <h1
          className="mt-4 max-w-2xl"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem,5vw,3.2rem)', fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.05, color: 'var(--text)' }}
        >
          Notes on AI, research, and the work.
        </h1>
        <p className="mt-5 measure" style={{ color: 'var(--text-muted)', fontSize: 19 }}>
          {total} pieces on generative and agentic systems, the research underneath, and what it
          takes to ship them.
        </p>
      </Reveal>

      {posts.length === 0 ? (
        <p className="mt-20" style={{ color: 'var(--text-faint)' }}>Nothing published yet — the first piece is on its way.</p>
      ) : (
        <ol className="mt-16 space-y-px">
          {posts.map((post) => (
            <Reveal as="li" key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="group block py-8" style={{ borderTop: '1px solid var(--line)' }}>
                <div className="grid gap-4 md:grid-cols-[11rem_1fr]">
                  <div className="t-label" style={{ textTransform: 'none', letterSpacing: '.04em' }}>
                    {yearMonth(post.publishedAt)}{post.readTime ? ` · ${post.readTime} min` : ''}
                  </div>
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.3rem,2.4vw,1.7rem)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-.02em', lineHeight: 1.18 }}>
                      {post.title}
                    </h2>
                    {post.summary && <p className="mt-3 measure" style={{ color: 'var(--text-muted)', fontSize: 15 }}>{post.summary}</p>}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {post.tags.slice(0, 4).map((t) => <span key={t} className="au-chip">{t}</span>)}
                      <span className="link-arrow ml-1">Read <ArrowRight size={13} /></span>
                    </div>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </ol>
      )}

      {pages > 1 && (
        <nav className="mt-12 flex items-center justify-between" aria-label="Pagination" style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
          {page > 1 ? (
            <Link className="link-arrow" rel="prev" href={page === 2 ? '/blog' : `/blog?page=${page - 1}`}>Newer</Link>
          ) : <span />}
          <span className="t-label" style={{ textTransform: 'none' }}>Page {page} of {pages}</span>
          {page < pages ? (
            <Link className="link-arrow" rel="next" href={`/blog?page=${page + 1}`}>Older <ArrowRight size={13} /></Link>
          ) : <span />}
        </nav>
      )}
    </div>
  )
}
