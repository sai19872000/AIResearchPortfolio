// Client-IP resolution behind Cloud Run.
//
// X-Forwarded-For is "client-supplied..., <hop appended by Google Frontend>". The
// LEFTMOST entry is whatever the caller typed, so keying a limiter on it lets an
// attacker pick a fresh bucket per request. We key on the entry the trusted proxy
// appended: counting from the RIGHT, skipping (TRUSTED_PROXY_HOPS - 1) extra
// trusted hops (default 1 = Cloud Run's Google Frontend only).

export function clientIp(headers: Pick<Headers, 'get'>, trustedHops = Number(process.env.TRUSTED_PROXY_HOPS || 1)): string {
  const xff = (headers.get('x-forwarded-for') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (xff.length) {
    const hops = Number.isFinite(trustedHops) && trustedHops >= 1 ? Math.floor(trustedHops) : 1
    // Fewer entries than trusted hops: the proxy chain is shorter than configured; use the leftmost we have.
    return xff[Math.max(0, xff.length - hops)]
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
