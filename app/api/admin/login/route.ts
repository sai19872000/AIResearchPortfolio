import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkPassword, newSession, COOKIE } from '@/lib/auth'
import { clientIp } from '@/lib/clientip'
import { blocked, hit, LOGIN_FAIL_RULE, LOGIN_FAIL_DELAY_MS } from '@/lib/ratelimit'
import { rateStore } from '@/lib/ratelimit-store'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const ip = clientIp(req.headers)
  const store = rateStore()

  // 5 failures / 15 min / IP, then 429 until the window rolls over.
  const b = await blocked(store, LOGIN_FAIL_RULE, ip)
  if (b.blocked) {
    return NextResponse.json(
      { error: 'too many attempts' },
      { status: 429, headers: { 'Retry-After': String(b.retryAfterS) } },
    )
  }

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!checkPassword((body.password || '').toString())) {
    await hit(store, LOGIN_FAIL_RULE, ip)
    await new Promise((r) => setTimeout(r, LOGIN_FAIL_DELAY_MS))
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
