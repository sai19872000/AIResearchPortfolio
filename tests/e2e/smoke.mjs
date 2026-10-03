// Playwright smoke against `next start` in fixture mode (SITE_FIXTURE=1).
// Run via `npm run test:e2e` (builds, starts the server, runs this, stops it).
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100'
const browser = await chromium.launch()
const results = []
async function check(name, fn) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try { await fn(page, ctx); results.push(['ok', name]) }
  catch (e) { results.push(['FAIL', name, e]) }
  finally { await ctx.close() }
}

await check('home renders', async (page) => {
  const res = await page.goto(BASE + '/')
  assert.equal(res.status(), 200)
  await page.getByText('A physicist who ships.').waitFor()
})

await check('/blog lists 30 posts, paginates, newest first', async (page) => {
  await page.goto(BASE + '/blog')
  assert.equal(await page.locator('ol > li').count(), 30)
  await page.getByText('34 pieces').waitFor() // 35 fixtures, 1 unpublished
  await page.getByRole('link', { name: /Older/ }).click()
  await page.waitForURL(/page=2/)
  assert.equal(await page.locator('ol > li').count(), 4)
})

await check('post renders markdown, canonical, twitter image, JSON-LD', async (page) => {
  await page.goto(BASE + '/blog/fixture-post-01')
  await page.getByRole('heading', { name: 'Heading 1' }).waitFor()
  assert.match(await page.locator('link[rel=canonical]').getAttribute('href'), /\/blog\/fixture-post-01$/)
  assert.match(await page.locator('meta[name="twitter:image"]').getAttribute('content'), /og\.png$/)
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText())
  assert.equal(ld['@type'], 'Article')
})

await check('unpublished post is 404', async (page) => {
  const res = await page.goto(BASE + '/blog/fixture-post-35')
  assert.equal(res.status(), 404)
})

await check('contact form shows Message sent. on a 200 (mocked) and never the error', async (page) => {
  let posts = 0
  await page.route('**/api/contact', (route) => { posts++; route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }) })
  await page.goto(BASE + '/')
  await page.locator('input[name=name]').fill('Test')
  await page.locator('input[name=email]').fill('t@example.com')
  await page.locator('textarea[name=message]').fill('hello')
  await page.getByRole('button', { name: /Send message/ }).click()
  await page.getByText('Message sent.').waitFor()
  assert.equal(await page.getByText('Something didn’t send').count(), 0)
  assert.equal(posts, 1)
})

await check('contact form shows the error on a 500', async (page) => {
  await page.route('**/api/contact', (route) => route.fulfill({ status: 500, body: '{}' }))
  await page.goto(BASE + '/')
  await page.locator('input[name=name]').fill('Test')
  await page.locator('input[name=email]').fill('t@example.com')
  await page.locator('textarea[name=message]').fill('hello')
  await page.getByRole('button', { name: /Send message/ }).click()
  await page.getByText('Something didn’t send').waitFor()
})

await check('/admin redirects to /admin/login when signed out', async (page) => {
  await page.goto(BASE + '/admin')
  assert.match(page.url(), /\/admin\/login/)
})

await check('crawl surface: robots, sitemap, rss, health, headers', async (page, ctx) => {
  const r = ctx.request
  const robots = await r.get(BASE + '/robots.txt')
  assert.equal(robots.status(), 200)
  assert.match(await robots.text(), /Disallow: \/admin/)
  const sm = await r.get(BASE + '/sitemap.xml')
  assert.equal(sm.status(), 200)
  assert.equal(((await sm.text()).match(/<loc>/g) || []).length, 34 + 2)
  const rss = await r.get(BASE + '/blog/feed.xml')
  assert.equal(rss.status(), 200)
  assert.equal(((await rss.text()).match(/<item>/g) || []).length, 34)
  const hl = await r.get(BASE + '/api/health')
  const j = await hl.json()
  assert.equal(hl.status(), 200)
  assert.equal(j.version, 1)
  assert.equal(j.published_count, 34)
  const hdrs = (await r.get(BASE + '/')).headers()
  assert.equal(hdrs['x-content-type-options'], 'nosniff')
  assert.match(hdrs['content-security-policy'], /frame-ancestors 'none'/)
  assert.ok(!hdrs['x-powered-by'])
  assert.ok((await r.get(BASE + '/_next/image?url=%2Fa.png&w=64&q=75')).status() >= 400)
})

await check('contact limiter: 6th POST in an hour is 429', async (page, ctx) => {
  const ip = { 'x-forwarded-for': '198.51.100.7' }
  const body = { name: 'a', email: 'a@b.co', message: 'm' }
  let last
  for (let i = 0; i < 6; i++) last = await ctx.request.post(BASE + '/api/contact', { data: body, headers: ip })
  assert.equal(last.status(), 429)
})

await check('login limiter: 6th bad login is 429', async (page, ctx) => {
  const ip = { 'x-forwarded-for': '198.51.100.8' }
  const codes = []
  for (let i = 0; i < 6; i++) codes.push((await ctx.request.post(BASE + '/api/admin/login', { data: { password: 'nope' }, headers: ip })).status())
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 429])
})

await browser.close()
for (const r of results) console.log(r[0].padEnd(4), r[1], r[2] ? `\n     ${r[2].message}` : '')
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0)
