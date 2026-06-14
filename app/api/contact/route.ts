import { NextResponse } from 'next/server'
import { createContactMessage } from '@/lib/firestore'

export const runtime = 'nodejs'

const CONTACT_TO = process.env.CONTACT_TO_EMAIL || 'hello@saiteja.ai'

export async function POST(req: Request) {
  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const name = (body.name || '').toString().trim()
  const email = (body.email || '').toString().trim()
  const message = (body.message || '').toString().trim()
  const subject = (body.subject || '').toString().trim() || 'website contact'

  if (!name || !email || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'missing or invalid fields' }, { status: 422 })
  }
  if (message.length > 5000 || name.length > 200) {
    return NextResponse.json({ error: 'too long' }, { status: 422 })
  }

  // Persist first (source of truth), then best-effort email notify.
  await createContactMessage({ name, email, subject, message })

  const apiKey = process.env.SENDGRID_API_KEY
  if (apiKey) {
    try {
      const sg = (await import('@sendgrid/mail')).default
      sg.setApiKey(apiKey)
      await sg.send({
        to: CONTACT_TO,
        from: CONTACT_TO, // verified sender on the saiteja.ai domain
        replyTo: email,
        subject: `saiteja.ai — ${subject}`,
        text: `From: ${name} <${email}>\n\n${message}`,
      })
    } catch (err) {
      // Message is saved; surfacing email failure to the user adds no value.
      console.error('sendgrid notify failed', err)
    }
  }

  return NextResponse.json({ ok: true })
}
