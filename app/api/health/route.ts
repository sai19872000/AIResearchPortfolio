import { NextResponse } from 'next/server'
import { probeHealth } from '@/lib/firestore'
import { buildHealth, type HealthPayload } from '@/lib/health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Versioned outcome endpoint: build SHA + a real Firestore read + the freshness of
// the blog pipeline's output. In-process 60s cache so a probe loop cannot turn into
// a Firestore read loop. No secrets in the body.
const TTL_MS = 60_000
let cached: { at: number; body: HealthPayload } | null = null

export async function GET() {
  const now = Date.now()
  if (!cached || now - cached.at > TTL_MS) {
    cached = { at: now, body: buildHealth(await probeHealth(), process.env) }
  }
  return NextResponse.json(cached.body, {
    status: cached.body.ok ? 200 : 503,
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' },
  })
}
