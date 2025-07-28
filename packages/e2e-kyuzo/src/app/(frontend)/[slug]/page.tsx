import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPayload, CollectionSlug } from 'payload'

import config from '@/payload.config'

import type { Page } from '@repo/shared-types'

import { RenderBlocks } from '@/blocks/render-blocks'

import { generateMetadataFunction } from '@repo/website/src/utils/generate-metadata'

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const payload = await getPayload({ config })
  return generateMetadataFunction({ params: paramsPromise, payload })
}

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const pagesQuery = await payload.find({
    collection: 'pages' as CollectionSlug,
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const pages = pagesQuery.docs as unknown as Page[]

  const params = pages
    ?.filter((doc) => {
      return doc.slug !== 'home'
    })
    .map(({ slug }) => {
      return { slug }
    })

  return params
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const payload = await getPayload({ config })

  const { slug = 'home' } = await paramsPromise

  //let page: RequiredDataFromCollectionSlug<'pages'> | nulls

  const result = await payload.find({
    collection: 'pages',
    limit: 1,
    pagination: false,
    overrideAccess: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  const page = result.docs?.[0] || null

  if (!page) {
    if (slug === 'home') {
      return (
        <div>
          <h1>Home</h1>
        </div>
      )
    }
    return notFound()
  }

  const layout = { page }

  return (
    <article>
      <RenderBlocks blocks={layout.page.layout} />
    </article>
  )
}
