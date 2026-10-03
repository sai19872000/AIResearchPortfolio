// Contact-form validation + bot friction. Pure so it is unit-testable.

export const MIN_FILL_MS = 3000
export const MAX_SUBJECT = 200
export const MAX_NAME = 200
export const MAX_MESSAGE = 5000

export interface ContactInput {
  name: string
  email: string
  subject: string
  message: string
}

export type ContactResult =
  | { kind: 'ok'; value: ContactInput }
  | { kind: 'bot' } // honeypot / too-fast: pretend success, store nothing
  | { kind: 'invalid'; error: string }

export function parseContact(body: Record<string, unknown>, now = Date.now()): ContactResult {
  const s = (v: unknown) => (v == null ? '' : String(v)).trim()
  // Honeypot: a real browser never fills the hidden `website` field.
  if (s(body.website)) return { kind: 'bot' }
  // Fill-time token: the form stamps `_t` (ms epoch) at render; humans take > 3s.
  const t = Number(body._t)
  if (Number.isFinite(t) && t > 0 && now - t < MIN_FILL_MS) return { kind: 'bot' }

  const name = s(body.name)
  const email = s(body.email)
  const message = s(body.message)
  const subject = s(body.subject) || 'website contact'
  if (!name || !email || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { kind: 'invalid', error: 'missing or invalid fields' }
  }
  if (message.length > MAX_MESSAGE || name.length > MAX_NAME || subject.length > MAX_SUBJECT) {
    return { kind: 'invalid', error: 'too long' }
  }
  return { kind: 'ok', value: { name, email, subject, message } }
}
