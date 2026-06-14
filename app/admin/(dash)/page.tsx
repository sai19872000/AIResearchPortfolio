import Link from 'next/link'
import { listAllPosts, listGenRequests } from '@/lib/firestore'
import { GenerateForm } from '@/components/admin/generate-form'
import { yearMonth } from '@/lib/format'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  queued: 'var(--text-faint)', generating: 'var(--warning)', ready: 'var(--success)', failed: 'var(--danger)',
}

export default async function AdminDashboard() {
  const [posts, requests] = await Promise.all([listAllPosts(), listGenRequests()])
  const drafts = posts.filter((p) => !p.published)
  const published = posts.filter((p) => p.published)

  return (
    <div className="space-y-14">
      <section>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--text)' }}>
          Write a post.
        </h1>
        <p className="mt-2" style={{ color: 'var(--text-muted)', fontSize: 15 }}>
          Give a topic and any references. The factory writer drafts it on Claude (Max) and adds a hero image — then you review and publish.
        </p>
        <div className="mt-6"><GenerateForm /></div>
      </section>

      {requests.length > 0 && (
        <section>
          <span className="t-label seam-tick">Generation queue</span>
          <ul className="mt-5 space-y-px">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-3" style={{ borderTop: '1px solid var(--line)' }}>
                <div className="min-w-0">
                  <p style={{ color: 'var(--text)', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.topic}</p>
                  <p className="t-label" style={{ textTransform: 'none', letterSpacing: '.02em', marginTop: 2 }}>{yearMonth(r.createdAt)}{r.error ? ` · ${r.error}` : ''}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.resultSlug && <Link className="link-arrow" href={`/admin/posts/${r.resultSlug}`}>Open draft →</Link>}
                  <span className="au-status" style={{ color: STATUS_COLOR[r.status] }}>
                    <span className="au-status__dot" style={{ background: STATUS_COLOR[r.status] }} />{r.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PostList title="Drafts" posts={drafts} empty="No drafts yet." />
      <PostList title="Published" posts={published} empty="Nothing published yet." />
    </div>
  )
}

function PostList({ title, posts, empty }: { title: string; posts: Awaited<ReturnType<typeof listAllPosts>>; empty: string }) {
  return (
    <section>
      <span className="t-label seam-tick">{title} · {posts.length}</span>
      {posts.length === 0 ? (
        <p className="mt-5" style={{ color: 'var(--text-faint)', fontSize: 15 }}>{empty}</p>
      ) : (
        <ul className="mt-5 space-y-px">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={`/admin/posts/${p.slug}`} className="flex items-center justify-between gap-4 py-3" style={{ borderTop: '1px solid var(--line)' }}>
                <div className="min-w-0">
                  <p style={{ color: 'var(--text)', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                  <p className="t-label" style={{ textTransform: 'none', letterSpacing: '.02em', marginTop: 2 }}>{p.publishedAt ? yearMonth(p.publishedAt) : 'draft'} · {p.readTime || '—'} min · /{p.slug}</p>
                </div>
                <span className="link-arrow shrink-0">Edit →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
