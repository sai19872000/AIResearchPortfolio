import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST() {
  const jar = await cookies()
  jar.delete(COOKIE)
  return NextResponse.json({ ok: true })
}
