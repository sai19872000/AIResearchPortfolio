import { NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import { upsertPost, deletePost } from '@/lib/firestore'
import type { BlogPost } from '@/lib/types'

export const runtime = 'nodejs'

// Save (create/update) a post.
export async function PUT(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: Partial<BlogPost> & { slug?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const slug = (body.slug || '').trim()
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'invalid slug' }, { status: 422 })
  }
  const { slug: _s, ...rest } = body
  await upsertPost(slug, rest)
  return NextResponse.json({ ok: true, slug })
}

export async function DELETE(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const slug = new URL(req.url).searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 422 })
  await deletePost(slug)
  return NextResponse.json({ ok: true })
}
