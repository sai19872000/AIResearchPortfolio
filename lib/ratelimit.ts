import crypto from 'node:crypto'

// Fixed-window counter. The store is injected so the policy is unit-testable and
// the Firestore-backed store (lib/ratelimit-store.ts) stays a thin adapter.

export interface RateStore {
  /** Atomically add `by` to the bucket and return the new count. */
  incr(key: string, windowEndsAt: number, by: number): Promise<number>
  /** Current count without changing it. */
  peek(key: string): Promise<number>
}

export interface RateRule {
  scope: string // e.g. 'contact' | 'login-fail'
  limit: number
  windowMs: number
}

export const CONTACT_RULE: RateRule = { scope: 'contact', limit: 5, windowMs: 60 * 60 * 1000 }
export const LOGIN_FAIL_RULE: RateRule = { scope: 'login-fail', limit: 5, windowMs: 15 * 60 * 1000 }
export const LOGIN_FAIL_DELAY_MS = 500

export function bucketKey(rule: RateRule, ip: string, now: number): { key: string; windowEndsAt: number } {
  const w = Math.floor(now / rule.windowMs)
  const hash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32)
  return { key: `${rule.scope}-${hash}-${w}`, windowEndsAt: (w + 1) * rule.windowMs }
}

/** Count one event against the bucket. `allowed` is false once the count exceeds the limit. */
export async function hit(store: RateStore, rule: RateRule, ip: string, now = Date.now()) {
  const { key, windowEndsAt } = bucketKey(rule, ip, now)
  const count = await store.incr(key, windowEndsAt, 1)
  return { allowed: count <= rule.limit, count, retryAfterS: Math.max(1, Math.ceil((windowEndsAt - now) / 1000)) }
}

/** Is the bucket already full? (Does not count.) */
export async function blocked(store: RateStore, rule: RateRule, ip: string, now = Date.now()) {
  const { key, windowEndsAt } = bucketKey(rule, ip, now)
  const count = await store.peek(key)
  return { blocked: count >= rule.limit, count, retryAfterS: Math.max(1, Math.ceil((windowEndsAt - now) / 1000)) }
}

/** Give back one previously counted event (e.g. a successful login that was pre-counted). */
export async function refund(store: RateStore, rule: RateRule, ip: string, now = Date.now()) {
  const { key, windowEndsAt } = bucketKey(rule, ip, now)
  await store.incr(key, windowEndsAt, -1)
}

export type LoginAttempt =
  | { status: 'limited'; retryAfterS: number }
  | { status: 'ok' }
  | { status: 'wrong' }

/**
 * Count the attempt BEFORE checking the password so the increment is atomic with the
 * admission decision: N concurrent guesses can no longer all observe count 0. A correct
 * password refunds its slot, so only failures consume the budget.
 */
export async function attemptLogin(
  store: RateStore,
  rule: RateRule,
  ip: string,
  check: () => boolean,
  now = Date.now(),
): Promise<LoginAttempt> {
  const h = await hit(store, rule, ip, now)
  if (!h.allowed) return { status: 'limited', retryAfterS: h.retryAfterS }
  if (check()) {
    await refund(store, rule, ip, now)
    return { status: 'ok' }
  }
  return { status: 'wrong' }
}

export class MemoryStore implements RateStore {
  private m = new Map<string, { n: number; exp: number }>()
  async incr(key: string, windowEndsAt: number, by: number) {
    const cur = this.m.get(key)
    const n = (cur && cur.exp > Date.now() ? cur.n : 0) + by
    this.m.set(key, { n, exp: windowEndsAt })
    return n
  }
  async peek(key: string) {
    const cur = this.m.get(key)
    return cur && cur.exp > Date.now() ? cur.n : 0
  }
}
