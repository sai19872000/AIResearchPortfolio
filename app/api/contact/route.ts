import { NextResponse } from 'next/server'
import { createContactMessage } from '@/lib/firestore'
import { parseContact } from '@/lib/contact'
import { clientIp } from '@/lib/clientip'
import { hit, CONTACT_RULE } from '@/lib/ratelimit'
import { rateStore } from '@/lib/ratelimit-store'

export const runtime = 'nodejs'

const CONTACT_TO = process.env.CONTACT_TO_EMAIL || 'hello@saiteja.ai'

export async function POST(req: Request) {
  // Per-IP brake first (5/hour), before any parsing or writes.
  const rl = await hit(rateStore(), CONTACT_RULE, clientIp(req.headers))
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'too many messages, try again later' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterS) } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const parsed = parseContact(body ?? {})
  if (parsed.kind === 'bot') return NextResponse.json({ ok: true }) // look successful, store nothing
  if (parsed.kind === 'invalid') {
    return NextResponse.json({ error: parsed.error }, { status: 422 })
  }
  const { name, email, subject, message } = parsed.value

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
