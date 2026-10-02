import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkPassword, newSession, COOKIE } from '@/lib/auth'
import { clientIp } from '@/lib/clientip'
import { attemptLogin, LOGIN_FAIL_RULE, LOGIN_FAIL_DELAY_MS } from '@/lib/ratelimit'
import { rateStore } from '@/lib/ratelimit-store'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const ip = clientIp(req.headers)
  const store = rateStore()

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  // The attempt is counted before the password is checked (atomic admission), so a burst
  // of parallel guesses cannot all slip past the 5 / 15 min / IP cap.
  const r = await attemptLogin(store, LOGIN_FAIL_RULE, ip, () => checkPassword((body.password || '').toString()))
  if (r.status === 'limited') {
    return NextResponse.json(
      { error: 'too many attempts' },
      { status: 429, headers: { 'Retry-After': String(r.retryAfterS) } },
    )
  }
  if (r.status === 'wrong') {
    await new Promise((res) => setTimeout(res, LOGIN_FAIL_DELAY_MS))
    return NextResponse.json({ error: 'wrong password' }, { status: 401 })
  }
  const { value, expiresAt } = newSession()
  const jar = await cookies()
  jar.set(COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
  return NextResponse.json({ ok: true })
}
