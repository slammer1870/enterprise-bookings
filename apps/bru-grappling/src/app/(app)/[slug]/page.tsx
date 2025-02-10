import { getPayload, RequiredDataFromCollectionSlug } from 'payload'
import config from '@/payload.config'
import { RenderBlocks } from '@/blocks/render-block'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const pages = await payload.find({
    collection: 'pages',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const params = pages.docs
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

  let page: RequiredDataFromCollectionSlug<'pages'> | null

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

  page = result.docs?.[0] || null

  if (!page) {
    return notFound()
  }

  const layout = { page }

  return (
    <article className="p-0">
      <RenderBlocks blocks={layout.page.layout} />
    </article>
  )
}
