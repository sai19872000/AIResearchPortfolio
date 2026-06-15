import 'server-only'
import crypto from 'node:crypto'

// Draft preview tokens: HMAC-SHA256(slug, ADMIN_SESSION_SECRET), first 32 hex
// chars. Must match scripts/blog_bot.py's preview_url() exactly so the Telegram
// bot can link to an unpublished draft without exposing it publicly.
export function previewToken(slug: string): string {
  return crypto
    .createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '')
    .update(slug)
    .digest('hex')
    .slice(0, 32)
}

export function verifyPreviewToken(slug: string, token: string | undefined): boolean {
  if (!token || !process.env.ADMIN_SESSION_SECRET) return false
  const a = Buffer.from(token)
  const b = Buffer.from(previewToken(slug))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
