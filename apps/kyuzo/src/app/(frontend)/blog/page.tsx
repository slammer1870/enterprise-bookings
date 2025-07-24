import payloadConfig from '@/payload.config'
import { getPayload } from 'payload'
import { CollectionSlug } from 'payload'
import { Post } from '@repo/shared-types'

import { PostList } from '@repo/website/src/components/posts/post-list'

const getPosts = async (): Promise<Post[]> => {
  const payload = await getPayload({
    config: payloadConfig,
  })
  const postQuery = await payload.find({
    collection: 'posts' as CollectionSlug,
    where: {
      _status: {
        equals: 'published',
      },
    },
    overrideAccess: false,
  })
  return postQuery.docs as unknown as Post[]
}

export default async function BlogPage() {
  const posts = await getPosts()
  return (
    <div className="container mx-auto px-4 pt-24 min-h-screen relative">
      <h1 className="text-2xl font-medium">Blog</h1>
      <p className="text-gray-500 mb-4">
        Here you will find an array of posts around such topics as fitness, nutrition, performance,
        and more.
      </p>
      <PostList posts={posts} />
    </div>
  )
}
