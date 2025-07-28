import React from 'react'
import Link from 'next/link'
import { fetchLatestPosts } from '@repo/website/src/actions/posts'

type LatestPostsProps = {
  // No dynamic props needed
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
  return date.toLocaleDateString('en-US', options)
}

export const LatestPostsBlock: React.FC<LatestPostsProps> = async () => {
  const posts = await fetchLatestPosts()

  if (!posts || posts.length === 0) {
    return null
  }

  return (
    <section className="text-gray-900">
      <div className="py-20 lg:mx-52 px-4">
        <h5 className="mb-8 text-3xl font-medium">Latest Blog Posts</h5>
        <div className="mb-8 grid gap-8 border-t border-b py-8 md:grid-cols-3 md:py-12">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="relative col-span-1 h-full cursor-pointer"
            >
              <h6 className="mb-1 text-2xl font-semibold">{post.title}</h6>
              <p className="mb-12">{post.excerpt}</p>
              <span className="absolute bottom-0 left-0 text-sm font-medium">
                {formatDate(post.createdAt)}
              </span>
            </Link>
          ))}
        </div>
        <div className="flex w-full md:text-xl">
          <Link
            href="/blog"
            className="ml-auto cursor-pointer font-semibold underline underline-offset-8"
          >
            View all blog posts &#8594;
          </Link>
        </div>
      </div>
    </section>
  )
}
