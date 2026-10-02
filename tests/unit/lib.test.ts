import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientIp } from '../../lib/clientip'
import { CONTACT_RULE, LOGIN_FAIL_RULE, MemoryStore, blocked, hit } from '../../lib/ratelimit'
import { parseContact, MIN_FILL_MS } from '../../lib/contact'
import { buildHealth } from '../../lib/health'
import { buildRss, xmlEscape, postImage, jsonLdString, articleJsonLd } from '../../lib/seo'

const h = (v: Record<string, string>) => ({ get: (k: string) => v[k.toLowerCase()] ?? null })

test('clientIp keys on the proxy-appended (rightmost) hop, not the spoofable leftmost', () => {
  assert.equal(clientIp(h({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }), 1), '203.0.113.9')
  assert.equal(clientIp(h({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9, 130.211.0.1' }), 2), '203.0.113.9')
  assert.equal(clientIp(h({ 'x-forwarded-for': '203.0.113.9' }), 1), '203.0.113.9')
  assert.equal(clientIp(h({}), 1), 'unknown')
  assert.equal(clientIp(h({ 'x-forwarded-for': '1.1.1.1' }), 5), '1.1.1.1') // chain shorter than configured
})

test('contact limiter: 5 allowed per hour, 6th rejected, per IP', async () => {
  const s = new MemoryStore()
  const now = Date.now()
  for (let i = 0; i < 5; i++) assert.equal((await hit(s, CONTACT_RULE, '1.2.3.4', now)).allowed, true)
  const sixth = await hit(s, CONTACT_RULE, '1.2.3.4', now)
  assert.equal(sixth.allowed, false)
  assert.ok(sixth.retryAfterS >= 1)
  assert.equal((await hit(s, CONTACT_RULE, '9.9.9.9', now)).allowed, true) // other IP unaffected
})

test('login limiter blocks after 5 failures', async () => {
  const s = new MemoryStore()
  const now = Date.now()
  for (let i = 0; i < 5; i++) {
    assert.equal((await blocked(s, LOGIN_FAIL_RULE, 'ip', now)).blocked, false)
    await hit(s, LOGIN_FAIL_RULE, 'ip', now)
  }
  assert.equal((await blocked(s, LOGIN_FAIL_RULE, 'ip', now)).blocked, true)
})

test('parseContact: honeypot, too-fast, caps, valid', () => {
  const ok = { name: 'A', email: 'a@b.co', message: 'hi' }
  const now = 1_000_000_000_000
  assert.equal(parseContact({ ...ok, website: 'http://spam' }, now).kind, 'bot')
  assert.equal(parseContact({ ...ok, _t: String(now - (MIN_FILL_MS - 500)) }, now).kind, 'bot')
  assert.equal(parseContact({ ...ok, _t: String(now - 10_000) }, now).kind, 'ok')
  assert.equal(parseContact({ ...ok, subject: 'x'.repeat(201) }, now).kind, 'invalid')
  assert.equal(parseContact({ ...ok, email: 'nope' }, now).kind, 'invalid')
  const v = parseContact(ok, now)
  assert.ok(v.kind === 'ok' && v.value.subject === 'website contact')
})

test('buildHealth exposes sha + email flag but no secrets', () => {
  const p = buildHealth({ firestore_ok: true, published_count: 3, latest_published_at: 'x' }, { GIT_SHA: 'abc', SENDGRID_API_KEY: 'SG.secret' })
  assert.equal(p.sha, 'abc')
  assert.equal(p.email_notify_configured, true)
  assert.equal(p.version, 1)
  assert.ok(!JSON.stringify(p).includes('SG.secret'))
  assert.equal(buildHealth({ firestore_ok: false, published_count: null, latest_published_at: null }, {}).ok, false)
})

test('rss escapes and lists items', () => {
  const xml = buildRss([{ slug: 'a-b', title: 'Fish & <Chips>', summary: 'x', publishedAt: '2026-09-01T00:00:00Z' }])
  assert.match(xml, /<title>Fish &amp; &lt;Chips&gt;<\/title>/)
  assert.match(xml, /<guid isPermaLink="true">https:\/\/saiteja\.ai\/blog\/a-b<\/guid>/)
  assert.equal(xmlEscape('a\u0001b'), 'ab')
})

test('postImage prefers the source screenshot, then hero, then the site image', () => {
  assert.equal(postImage({ sourceScreenshot: 'https://x/s.png', heroImage: 'https://x/h.png' }), 'https://x/s.png')
  assert.equal(postImage({ heroImage: '/art/h.png' }), 'https://saiteja.ai/art/h.png')
  assert.equal(postImage({}), 'https://saiteja.ai/art/og.png')
})

test('json-ld cannot break out of its script tag', () => {
  const s = jsonLdString(articleJsonLd({ slug: 's', title: '</script><b>', summary: null, publishedAt: null, updatedAt: null }))
  assert.ok(!s.includes('</script>'))
})
