import { listLatestFull } from '@/lib/firestore'
import { buildRss } from '@/lib/seo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const posts = await listLatestFull(50)
  return new Response(buildRss(posts), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300',
    },
  })
}
