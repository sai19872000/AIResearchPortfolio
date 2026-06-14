import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkPassword, newSession, COOKIE } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!checkPassword((body.password || '').toString())) {
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
