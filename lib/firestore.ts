import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { Firestore } from '@google-cloud/firestore'
import type { BlogPost, BlogPostSummary, BlogGenRequest, Portfolio, Reference } from './types'

// Fixture mode (CI + e2e only): SITE_FIXTURE=1 serves portfolio-content.json and
// tests/fixtures/posts.json instead of Firestore, so `next start` runs hermetically.
// Never set in production (scripts/deploy.sh does not pass it).
const FIXTURE = process.env.SITE_FIXTURE === '1'
const fixtureContacts: unknown[] = []

function fixtureJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), rel), 'utf8')) as T
}
function fixturePosts(): BlogPost[] {
  return fixtureJson<BlogPost[]>('tests/fixtures/posts.json')
}

/** Cached-read window for public blog data (seconds). Posts are also published
 * straight in Firestore by the Telegram bot, so a time-based window (not only
 * revalidateTag from the admin route) is what bounds staleness. */
export const POSTS_REVALIDATE_S = 300
export const POSTS_TAG = 'posts'

// Pinned to the named Firestore database created for this site.
// Auth: Application Default Credentials (Cloud Run runtime SA in prod;
// `gcloud auth application-default` locally). Note: locally, unset
// GOOGLE_APPLICATION_CREDENTIALS if it points at another project's SA key.
const PROJECT_ID = process.env.FIRESTORE_PROJECT_ID || 'auracle-prod-311'
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'saiteja-site'

declare global {
  // eslint-disable-next-line no-var
  var __saiteja_db: Firestore | undefined
}

function db(): Firestore {
  if (!global.__saiteja_db) {
    global.__saiteja_db = new Firestore({
      projectId: PROJECT_ID,
      databaseId: DATABASE_ID,
      ignoreUndefinedProperties: true,
    })
  }
  return global.__saiteja_db
}

export async function getPortfolio(): Promise<Portfolio> {
  if (FIXTURE) return fixtureJson<Portfolio>('portfolio-content.json')
  const snap = await db().collection('portfolio').doc('main').get()
  if (!snap.exists) throw new Error('portfolio/main missing in Firestore')
  return snap.data() as Portfolio
}

function toPost(data: FirebaseFirestore.DocumentData): BlogPost {
  return data as BlogPost
}

const SUMMARY_FIELDS = ['slug', 'title', 'summary', 'tags', 'publishedAt', 'readTime', 'updatedAt'] as const

function toSummary(p: Partial<BlogPost>): BlogPostSummary {
  return {
    slug: p.slug as string,
    title: p.title as string,
    summary: p.summary ?? null,
    tags: p.tags ?? [],
    publishedAt: p.publishedAt ?? null,
    readTime: p.readTime ?? null,
    updatedAt: p.updatedAt ?? null,
  }
}

function newestFirst(a: BlogPostSummary, b: BlogPostSummary): number {
  return (b.publishedAt || '').localeCompare(a.publishedAt || '')
}

async function readPublishedSummaries(): Promise<BlogPostSummary[]> {
  if (FIXTURE) return fixturePosts().filter((p) => p.published).map(toSummary).sort(newestFirst)
  // Server-side filter + field projection: no full markdown bodies over the wire.
  const snap = await db()
    .collection('blogPosts')
    .where('published', '==', true)
    .select(...SUMMARY_FIELDS)
    .get()
  return snap.docs.map((d) => toSummary(d.data() as Partial<BlogPost>)).sort(newestFirst)
}

const cachedPublishedSummaries = unstable_cache(readPublishedSummaries, ['published-summaries'], {
  revalidate: POSTS_REVALIDATE_S,
  tags: [POSTS_TAG],
})

/** Published posts (summary fields only), newest first. Cached for POSTS_REVALIDATE_S. */
export async function listPosts(): Promise<BlogPostSummary[]> {
  return cachedPublishedSummaries()
}

export const BLOG_PAGE_SIZE = 30

/** One page of the blog index. `page` is 1-based and clamped into range. */
export async function listPostsPage(
  page: number,
  pageSize = BLOG_PAGE_SIZE,
): Promise<{ posts: BlogPostSummary[]; page: number; pages: number; total: number }> {
  const all = await listPosts()
  const pages = Math.max(1, Math.ceil(all.length / pageSize))
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages)
  return { posts: all.slice((p - 1) * pageSize, p * pageSize), page: p, pages, total: all.length }
}

/** Latest published posts including the body, for the RSS feed. */
export async function listLatestFull(limit = 50): Promise<BlogPost[]> {
  if (FIXTURE) {
    return fixturePosts()
      .filter((p) => p.published)
      .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
      .slice(0, limit)
  }
  const slugs = (await listPosts()).slice(0, limit).map((p) => p.slug)
  const docs = await Promise.all(slugs.map((s) => db().collection('blogPosts').doc(s).get()))
  return docs.filter((d) => d.exists).map((d) => toPost(d.data()!))
}

// React cache(): generateMetadata and the page render share ONE read per request.
export const getPost = cache(async (slug: string): Promise<BlogPost | null> => {
  if (FIXTURE) return fixturePosts().find((p) => p.slug === slug) ?? null
  const snap = await db().collection('blogPosts').doc(slug).get()
  return snap.exists ? toPost(snap.data()!) : null
})

export async function getReferences(ids: string[]): Promise<Reference[]> {
  if (!ids.length || FIXTURE) return []
  const refs = await Promise.all(
    ids.map((id) => db().collection('references').doc(id).get()),
  )
  return refs.filter((r) => r.exists).map((r) => r.data() as Reference)
}

export async function allSlugs(): Promise<string[]> {
  return (await listPosts()).map((p) => p.slug)
}

/** Sitemap source: every published post with its dates. */
export async function listPublishedForSitemap(): Promise<
  { slug: string; publishedAt: string | null; updatedAt: string | null }[]
> {
  return (await listPosts()).map((p) => ({ slug: p.slug, publishedAt: p.publishedAt, updatedAt: p.updatedAt }))
}

export interface HealthProbe {
  firestore_ok: boolean
  published_count: number | null
  latest_published_at: string | null
}

/** Cheap liveness + data probe for /api/health (cached 60s by the route). */
export async function probeHealth(): Promise<HealthProbe> {
  try {
    const posts = await readPublishedSummaries() // uncached on purpose: a real read
    return {
      firestore_ok: true,
      published_count: posts.length,
      latest_published_at: posts[0]?.publishedAt ?? null,
    }
  } catch {
    return { firestore_ok: false, published_count: null, latest_published_at: null }
  }
}

export async function createContactMessage(msg: {
  name: string
  email: string
  subject?: string
  message: string
}): Promise<void> {
  if (FIXTURE) {
    fixtureContacts.push({ ...msg, createdAt: new Date().toISOString() })
    return
  }
  await db().collection('contactMessages').add({
    ...msg,
    createdAt: new Date().toISOString(),
  })
}

// ---- admin: all posts (incl. drafts), CRUD, generation queue ----

export async function listAllPosts(): Promise<BlogPost[]> {
  const snap = await db().collection('blogPosts').get()
  return snap.docs
    .map((d) => d.data() as BlogPost)
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
}

export async function upsertPost(slug: string, data: Partial<BlogPost>): Promise<void> {
  await db().collection('blogPosts').doc(slug).set(
    { ...data, slug, updatedAt: new Date().toISOString() },
    { merge: true },
  )
}

export async function deletePost(slug: string): Promise<void> {
  await db().collection('blogPosts').doc(slug).delete()
}

export async function createGenRequest(input: {
  topic: string
  angle?: string
  referenceUrls?: string[]
  references?: { title: string | null; url: string | null; text: string }[]
  options?: { tone?: string; length?: string }
}): Promise<string> {
  const now = new Date().toISOString()
  const ref = await db().collection('blogGenRequests').add({
    topic: input.topic,
    angle: input.angle || null,
    referenceUrls: input.referenceUrls || [],
    references: input.references || [],
    options: input.options || {},
    status: 'queued',
    error: null,
    resultSlug: null,
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

export async function listGenRequests(limit = 20): Promise<BlogGenRequest[]> {
  const snap = await db().collection('blogGenRequests').get()
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<BlogGenRequest, 'id'>) }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, limit)
}
