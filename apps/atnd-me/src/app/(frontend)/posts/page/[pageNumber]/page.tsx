import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import React from 'react'
import PageClient from './page.client'
import { notFound } from 'next/navigation'
import { queryPostsArchive } from '../../queryPostsArchive'
import { getPayload } from '@/lib/payload'
import { generateMeta } from '@/utilities/generateMeta'
import { getTenantWithBranding } from '@/utilities/getTenantContext'

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
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Posts</h1>
          <p className="mt-2 text-muted-foreground">
            Articles, updates and stories from our team.
          </p>
        </div>

        <div className="mb-8">
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
        <div>
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
  const { cookies, headers } = await import('next/headers')
  const cookieStore = await cookies()
  const headersList = await headers()
  const payload = await getPayload()
  const tenantBranding = await getTenantWithBranding(payload, {
    cookies: cookieStore,
    headers: headersList,
  })
  const pageLabel = pageNumber ? `Posts (Page ${pageNumber})` : 'Posts'

  return generateMeta({
    doc: {
      slug: 'posts',
      meta: {
        title: pageLabel,
        description: 'Articles, updates and stories from our team.',
      },
    },
    tenantBranding,
    pathname: pageNumber ? `/posts/page/${pageNumber}` : '/posts',
    headers: headersList,
  })
}

/** Paginated routes are resolved per tenant at request time. */
export async function generateStaticParams() {
  return []
}
