import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import React from 'react'
import PageClient from './page.client'
import { notFound } from 'next/navigation'
import { queryPostsArchive } from '../../queryPostsArchive'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_SIZE = 12

type Args = {
  params: Promise<{
    pageNumber: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { pageNumber } = await paramsPromise

  const sanitizedPageNumber = Number(pageNumber)

  if (!Number.isInteger(sanitizedPageNumber) || sanitizedPageNumber < 1) notFound()

  const posts = await queryPostsArchive({ page: sanitizedPageNumber, limit: PAGE_SIZE })

  return (
    <div className="min-h-screen pt-24 pb-24">
      <PageClient />
      <div className="container mx-auto">
        <div className="px-4 mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Posts</h1>
          <p className="mt-2 text-muted-foreground">
            Articles, updates and stories from our team.
          </p>
        </div>

        <div className="px-4 mb-8">
          <PageRange
            collection="posts"
            currentPage={posts.page}
            limit={PAGE_SIZE}
            totalDocs={posts.totalDocs}
          />
        </div>
      </div>

      <CollectionArchive posts={posts.docs} />

      <div className="container mx-auto">
        <div className="px-4">
          {posts?.page && posts?.totalPages > 1 && (
            <Pagination page={posts.page} totalPages={posts.totalPages} />
          )}
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { pageNumber } = await paramsPromise
  return {
    title: pageNumber ? `Posts (Page ${pageNumber})` : 'Posts',
  }
}

/** Paginated routes are resolved per tenant at request time. */
export async function generateStaticParams() {
  return []
}
