// Mark this route as dynamic to avoid static generation issues with Payload GraphQL schema
export const dynamic = 'force-dynamic'

import payloadConfig from '@/payload.config'
import { getPayload } from 'payload'
import { CollectionSlug } from 'payload'
import { Post } from '@repo/shared-types'
import { Metadata } from 'next'
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
  })
  return postQuery.docs as unknown as Post[]
}

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = process.env.NEXT_PUBLIC_SERVER_URL
    ? new URL(process.env.NEXT_PUBLIC_SERVER_URL)
    : new URL('https://brugrappling.ie')

  return {
    title: 'Blog',
    description: 'Discover expert insights on Brazilian Jiu Jitsu, fitness, nutrition, and performance.',
    openGraph: {
      title: 'Blog',
      description: 'Discover expert insights on Brazilian Jiu Jitsu, fitness, nutrition, and performance.',
      type: 'website',
      url: new URL('/blog', metadataBase).toString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Blog',
      description: 'Discover expert insights on Brazilian Jiu Jitsu, fitness, nutrition, and performance.',
    },
    metadataBase,
  }
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
