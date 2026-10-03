// /api/health payload (versioned). No secrets: only booleans, counts, a timestamp
// and the build SHA. The route caches it for 60s.

export const HEALTH_VERSION = 1

export interface HealthPayload {
  version: number
  ok: boolean
  sha: string | null
  firestore_ok: boolean
  published_count: number | null
  latest_published_at: string | null
  email_notify_configured: boolean
  checked_at: string
}

export function buildHealth(
  probe: { firestore_ok: boolean; published_count: number | null; latest_published_at: string | null },
  env: Record<string, string | undefined>,
  now = new Date(),
): HealthPayload {
  return {
    version: HEALTH_VERSION,
    ok: probe.firestore_ok,
    sha: env.GIT_SHA || null,
    firestore_ok: probe.firestore_ok,
    published_count: probe.published_count,
    latest_published_at: probe.latest_published_at,
    email_notify_configured: Boolean(env.SENDGRID_API_KEY),
    checked_at: now.toISOString(),
  }
}
