import 'server-only'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'

// Single-user admin auth: a password (env) → signed httpOnly session cookie.
// HMAC-SHA256 over "admin.<expiry>" with ADMIN_SESSION_SECRET. No DB, no infra.

export const COOKIE = 'saiteja_admin'
const TTL_MS = 1000 * 60 * 60 * 12 // 12h

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || ''
}

export function signSession(expiresAt: number): string {
  const payload = `admin.${expiresAt}`
  const mac = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${mac}`
}

export function newSession(): { value: string; expiresAt: Date } {
  const exp = Date.now() + TTL_MS
  return { value: signSession(exp), expiresAt: new Date(exp) }
}

export function verifySession(token: string | undefined): boolean {
  if (!token || !secret()) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [sub, exp, mac] = parts
  const expected = crypto.createHmac('sha256', secret()).update(`${sub}.${exp}`).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  if (!Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return false
  return sub === 'admin'
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies()
  return verifySession(jar.get(COOKIE)?.value)
}

export function checkPassword(pw: string): boolean {
  const real = process.env.ADMIN_PASSWORD || ''
  if (!real || !pw) return false
  const a = Buffer.from(pw)
  const b = Buffer.from(real)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
