// Sitemap / RSS / JSON-LD builders. Pure (no Firestore) so they are unit-testable.

export const SITE_URL = process.env.SITE_BASE_URL || 'https://saiteja.ai'

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // strip chars illegal in XML 1.0
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

export function postUrl(slug: string): string {
  return `${SITE_URL}/blog/${slug}`
}

export function absUrl(u: string | null | undefined): string {
  if (!u) return `${SITE_URL}/art/og.png`
  return /^https?:\/\//.test(u) ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`
}

/** The image a post shares as: the source screenshot wins, then hero, then the site image. */
export function postImage(p: { sourceScreenshot?: string | null; heroImage?: string | null }): string {
  return absUrl(p.sourceScreenshot || p.heroImage)
}

export interface FeedPost {
  slug: string
  title: string
  summary: string | null
  publishedAt: string | null
  tags?: string[]
}

export function buildRss(posts: FeedPost[], now = new Date()): string {
  const items = posts
    .map((p) => {
      const date = p.publishedAt ? new Date(p.publishedAt) : null
      return [
        '    <item>',
        `      <title>${xmlEscape(p.title)}</title>`,
        `      <link>${xmlEscape(postUrl(p.slug))}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(postUrl(p.slug))}</guid>`,
        date && !isNaN(date.getTime()) ? `      <pubDate>${date.toUTCString()}</pubDate>` : '',
        p.summary ? `      <description>${xmlEscape(p.summary)}</description>` : '',
        ...(p.tags || []).map((t) => `      <category>${xmlEscape(t)}</category>`),
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sai Teja Pusuluri — Writing</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <description>Notes on generative AI, agentic systems, research, and the engineering behind them.</description>
    <language>en</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`
}

export function articleJsonLd(p: {
  slug: string
  title: string
  summary: string | null
  publishedAt: string | null
  updatedAt: string | null
  sourceScreenshot?: string | null
  heroImage?: string | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.title,
    description: p.summary || undefined,
    image: postImage(p),
    datePublished: p.publishedAt || undefined,
    dateModified: p.updatedAt || p.publishedAt || undefined,
    mainEntityOfPage: postUrl(p.slug),
    author: { '@type': 'Person', name: 'Sai Teja Pusuluri', url: SITE_URL },
  }
}

/** JSON-LD is embedded in a <script>; neutralise `</script>` / HTML comment openers. */
export function jsonLdString(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}
