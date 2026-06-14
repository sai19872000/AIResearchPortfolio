import { NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import { createGenRequest } from '@/lib/firestore'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: {
    topic?: string
    angle?: string
    referenceUrls?: string[]
    references?: { title: string | null; url: string | null; text: string }[]
    options?: { tone?: string; length?: string }
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const topic = (body.topic || '').trim()
  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 422 })

  const id = await createGenRequest({
    topic,
    angle: body.angle?.trim() || undefined,
    referenceUrls: (body.referenceUrls || []).map((u) => u.trim()).filter(Boolean),
    references: body.references || [],
    options: body.options || {},
  })
  return NextResponse.json({ ok: true, id })
}
