import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import React from 'react'
import PageClient from './page.client'
import { queryPostsArchive } from './queryPostsArchive'
import { getPayload } from '@/lib/payload'
import { generateMeta } from '@/utilities/generateMeta'
import { getTenantWithBranding } from '@/utilities/getTenantContext'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_SIZE = 12

export default async function Page() {
  const posts = await queryPostsArchive({ page: 1, limit: PAGE_SIZE })

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
          {posts.totalPages > 1 && posts.page && (
            <Pagination page={posts.page} totalPages={posts.totalPages} />
          )}
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const { cookies, headers } = await import('next/headers')
  const cookieStore = await cookies()
  const headersList = await headers()
  const payload = await getPayload()
  const tenantBranding = await getTenantWithBranding(payload, {
    cookies: cookieStore,
    headers: headersList,
  })

  return generateMeta({
    doc: {
      slug: 'posts',
      meta: {
        title: 'Posts',
        description: 'Articles, updates and stories from our team.',
      },
    },
    tenantBranding,
    pathname: '/posts',
    headers: headersList,
  })
}
