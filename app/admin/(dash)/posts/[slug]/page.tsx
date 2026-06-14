import { notFound } from 'next/navigation'
import { getPost } from '@/lib/firestore'
import { PostEditor } from '@/components/admin/post-editor'

export const dynamic = 'force-dynamic'

export default async function EditPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (slug === 'new') {
    return <PostEditor isNew post={{ slug: '', title: '', content: '', tags: [], published: false }} />
  }
  const post = await getPost(slug)
  if (!post) notFound()
  return <PostEditor isNew={false} post={post} />
}
