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
  return {
    title: 'Blog - Brazilian Jiu Jitsu Articles & Tips',
    description: 'Discover expert insights on Brazilian Jiu Jitsu, fitness, nutrition, and performance. Stay updated with the latest BJJ techniques and training advice.',
    keywords: ['BJJ blog', 'Brazilian Jiu Jitsu tips', 'Grappling techniques', 'Martial arts training', 'BJJ fitness', 'Self defense tips'],
    openGraph: {
      title: 'Blog - Brazilian Jiu Jitsu Articles & Tips',
      description: 'Discover expert insights on Brazilian Jiu Jitsu, fitness, nutrition, and performance.',
      type: 'website',
      url: 'https://brugrappling.ie/blog',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Blog - Brazilian Jiu Jitsu Articles & Tips',
      description: 'Discover expert insights on Brazilian Jiu Jitsu, fitness, nutrition, and performance.',
    },
    alternates: {
      canonical: 'https://brugrappling.ie/blog',
    },
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
