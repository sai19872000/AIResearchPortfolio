import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { listPosts } from '@/lib/firestore'
import { Reveal } from '@/components/site/reveal'
import { ThemeChip } from '@/components/aura/theme-chip'
import { EmptyState } from '@/components/aura/empty-state'
import { yearMonth } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'writing',
  description:
    'Notes on generative AI, agentic systems, research, and the engineering behind them — by Sai Teja Pusuluri.',
}

export default async function BlogIndex() {
  const posts = await listPosts()

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-24 pt-36">
      <Reveal>
        <span className="eyebrow">writing</span>
        <h1
          className="mt-4 max-w-2xl"
          style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', fontWeight: 300, letterSpacing: 'var(--tracking-display)', lineHeight: 'var(--lh-h1)', color: 'var(--fg)' }}
        >
          notes on ai, research, and the work.
        </h1>
        <p className="mt-5 measure" style={{ color: 'var(--fg-muted)' }}>
          {posts.length} pieces on generative and agentic systems, the research underneath, and what
          it takes to ship them.
        </p>
      </Reveal>

      {posts.length === 0 ? (
        <div className="mt-20">
          <EmptyState headline="nothing here yet" italic="just a moment" subtext="the first piece is on its way." />
        </div>
      ) : (
        <ol className="mt-16 space-y-px">
          {posts.map((post, i) => (
            <Reveal as="li" key={post.slug} delay={Math.min(i * 0.03, 0.12)}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block py-8"
                style={{ borderTop: '1px solid var(--border)', textDecoration: 'none' }}
              >
                <div className="grid gap-4 md:grid-cols-[10rem_1fr]">
                  <div className="text-xs" style={{ color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                    {yearMonth(post.publishedAt)}
                    {post.readTime ? ` · ${post.readTime} min` : ''}
                  </div>
                  <div>
                    <h2
                      className="transition-colors"
                      style={{ fontSize: 'clamp(1.25rem,2.4vw,1.6rem)', fontWeight: 400, color: 'var(--fg)', letterSpacing: 'var(--tracking-display)', lineHeight: 'var(--lh-h3)' }}
                    >
                      {post.title}
                    </h2>
                    {post.summary && (
                      <p className="mt-3 measure text-sm" style={{ color: 'var(--fg-muted)' }}>{post.summary}</p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {post.tags.slice(0, 4).map((t) => <ThemeChip key={t} label={t} />)}
                      <span className="link-arrow ml-1">read <ArrowRight size={13} weight="bold" /></span>
                    </div>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </ol>
      )}
    </div>
  )
}
