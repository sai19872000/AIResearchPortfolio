import { NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

// Accept a PDF, extract its text so the watcher can cite it. Returns the
// extracted text; the client attaches it to the generation request. We do not
// persist the binary — only the text matters for citation.
export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 422 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'file too large (max 20MB)' }, { status: 422 })

  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const buf = new Uint8Array(await file.arrayBuffer())
    const pdf = await getDocumentProxy(buf)
    const { text } = await extractText(pdf, { mergePages: true })
    const clean = (Array.isArray(text) ? text.join('\n') : text).replace(/\s+\n/g, '\n').trim()
    return NextResponse.json({
      ok: true,
      title: file.name.replace(/\.pdf$/i, ''),
      text: clean.slice(0, 60_000), // cap context size
      chars: clean.length,
    })
  } catch (err) {
    return NextResponse.json({ error: `could not read pdf: ${(err as Error).message}` }, { status: 422 })
  }
}
