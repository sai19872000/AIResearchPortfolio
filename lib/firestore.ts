import 'server-only'
import { Firestore } from '@google-cloud/firestore'
import type { BlogPost, BlogGenRequest, Portfolio, Reference } from './types'

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
  const snap = await db().collection('portfolio').doc('main').get()
  if (!snap.exists) throw new Error('portfolio/main missing in Firestore')
  return snap.data() as Portfolio
}

function toPost(data: FirebaseFirestore.DocumentData): BlogPost {
  return data as BlogPost
}

/** Published posts, newest first. */
export async function listPosts(opts?: { includeDrafts?: boolean }): Promise<BlogPost[]> {
  const snap = await db().collection('blogPosts').get()
  const posts = snap.docs.map((d) => toPost(d.data()))
  const filtered = opts?.includeDrafts ? posts : posts.filter((p) => p.published)
  return filtered.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  const snap = await db().collection('blogPosts').doc(slug).get()
  return snap.exists ? toPost(snap.data()!) : null
}

export async function getReferences(ids: string[]): Promise<Reference[]> {
  if (!ids.length) return []
  const refs = await Promise.all(
    ids.map((id) => db().collection('references').doc(id).get()),
  )
  return refs.filter((r) => r.exists).map((r) => r.data() as Reference)
}

export async function allSlugs(): Promise<string[]> {
  const snap = await db().collection('blogPosts').where('published', '==', true).get()
  return snap.docs.map((d) => (d.data() as BlogPost).slug)
}

export async function createContactMessage(msg: {
  name: string
  email: string
  subject?: string
  message: string
}): Promise<void> {
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
