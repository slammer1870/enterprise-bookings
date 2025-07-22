import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { CollectionSlug, getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'

import { RichText } from '@payloadcms/richtext-lexical/react'

import { Post } from '@repo/shared-types'

import { generatePostMetadataFunction } from '@repo/website/src/utils/generate-post-metadata'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const postsQuery = await payload.find({
    collection: 'posts' as CollectionSlug,
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const posts = postsQuery.docs as unknown as Post[]

  const params = posts.map(({ slug }) => {
    return { slug }
  })

  return params
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function BlogPost({ params: paramsPromise }: Args) {
  const { slug = '' } = await paramsPromise
  const post = await queryPostBySlug({ slug })

  if (!post) return notFound()

  return (
    <article className="pt-24 pb-16 container mx-auto px-4 max-w-4xl">
      <div className="flex flex-col items-center gap-4">
        <Link href="/blog/" className="mr-auto">
          <button className="flex font-light text-blue-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2 h-6 w-6"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="square" strokeWidth="1" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            <p className="text-blue-500">BACK TO BLOG</p>
          </button>
        </Link>
        <h3 className="text-4xl font-bold text-left mr-auto">{post.title}</h3>
        <RichText className="max-w-4xl mx-auto prose prose-lg" data={post.content} />
      </div>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const payload = await getPayload({ config: configPromise })

  return generatePostMetadataFunction({ params: paramsPromise, payload })
}

const queryPostBySlug = cache(async ({ slug }: { slug: string }): Promise<Post | null> => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'posts' as CollectionSlug,
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
    depth: 1,
  })

  return result.docs?.[0]
    ? ({
        ...result.docs[0],
        id: String(result.docs[0].id),
      } as Post)
    : null
})
