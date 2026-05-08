import { getPayload } from '@/lib/payload'
import { getTenantContext } from '@/utilities/getTenantContext'
import type { Where } from 'payload'
import { cookies, draftMode, headers } from 'next/headers'
import { cache } from 'react'
import { createCaller } from '@/trpc/server'
import type { CardPostData } from '@/components/Card'

const DEFAULT_LIMIT = 12

export const queryPostsArchive = cache(
  async (opts?: { page?: number; limit?: number }) => {
    const page = opts?.page ?? 1
    const limit = opts?.limit ?? DEFAULT_LIMIT
    const { isEnabled: draft } = await draftMode()
    const cookieStore = await cookies()
    const headersList = await headers()
    const payload = await getPayload()
    const tenant = await getTenantContext(payload, { cookies: cookieStore, headers: headersList })
    const tenantId = tenant?.id ?? null

    const caller = await createCaller()
    const result = await caller.content.posts.archive({
      page,
      limit,
      draft,
      tenantId,
    })

    return {
      ...result,
      docs: (result.docs ?? []) as CardPostData[],
    }
  },
)
