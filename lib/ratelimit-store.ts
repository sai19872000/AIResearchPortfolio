import 'server-only'
import { Firestore, FieldValue } from '@google-cloud/firestore'
import { MemoryStore, type RateStore } from './ratelimit'

// Firestore-backed fixed-window counters at rateLimits/{key}. Each doc carries an
// `expireAt` Timestamp; enable a Firestore TTL policy on that field to garbage
// collect (see docs/OPERATIONS.md). Fails OPEN: a limiter outage must not take the
// contact form or admin login down (it is a spam/brute-force brake, not auth).

class FirestoreStore implements RateStore {
  constructor(private db: Firestore) {}
  async incr(key: string, windowEndsAt: number, by: number) {
    const ref = this.db.collection('rateLimits').doc(key)
    await ref.set({ n: FieldValue.increment(by), expireAt: new Date(windowEndsAt + 24 * 3600 * 1000) }, { merge: true })
    return ((await ref.get()).data()?.n as number) ?? by
  }
  async peek(key: string) {
    return ((await this.db.collection('rateLimits').doc(key).get()).data()?.n as number) ?? 0
  }
}

class FailOpen implements RateStore {
  constructor(private inner: RateStore) {}
  async incr(k: string, w: number, by: number) {
    try { return await this.inner.incr(k, w, by) } catch (e) { console.error('ratelimit incr failed (open)', e); return 0 }
  }
  async peek(k: string) {
    try { return await this.inner.peek(k) } catch (e) { console.error('ratelimit peek failed (open)', e); return 0 }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __saiteja_rl: RateStore | undefined
}

export function rateStore(): RateStore {
  if (!global.__saiteja_rl) {
    if (process.env.SITE_FIXTURE === '1') {
      global.__saiteja_rl = new MemoryStore()
    } else {
      const db = new Firestore({
        projectId: process.env.FIRESTORE_PROJECT_ID || 'auracle-prod-311',
        databaseId: process.env.FIRESTORE_DATABASE_ID || 'saiteja-site',
      })
      global.__saiteja_rl = new FailOpen(new FirestoreStore(db))
    }
  }
  return global.__saiteja_rl
}
