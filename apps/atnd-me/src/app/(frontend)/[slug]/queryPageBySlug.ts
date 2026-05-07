import { getPayload } from '@/lib/payload'
import { getTenantContext } from '@/utilities/getTenantContext'
import type { Page } from '@/payload-types'
import type { Where } from 'payload'
import { cookies, draftMode, headers } from 'next/headers'
import { cache } from 'react'
import { createCaller } from '@/trpc/server'

export const queryPageBySlug = cache(async ({ slug }: { slug: string }): Promise<Page | null> => {
  const { isEnabled: draft } = await draftMode()
  const cookieStore = await cookies()
  const headersList = await headers()
  const payload = await getPayload()
  const tenant = await getTenantContext(payload, { cookies: cookieStore, headers: headersList })
  const tenantId = tenant?.id ?? null

  const caller = await createCaller()
  return caller.content.pages.bySlug({
    slug,
    draft,
    tenantId,
  })
})

