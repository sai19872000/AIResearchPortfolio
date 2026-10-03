import type { MetadataRoute } from 'next'
import { listPublishedForSitemap } from '@/lib/firestore'
import { SITE_URL, postUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublishedForSitemap()
  return [
    { url: SITE_URL, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'daily', priority: 0.8 },
    ...posts.map((p) => ({
      url: postUrl(p.slug),
      lastModified: p.updatedAt || p.publishedAt || undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
