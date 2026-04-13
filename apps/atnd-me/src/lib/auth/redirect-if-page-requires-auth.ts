import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/context/get-context-props'

/** When a CMS page has `requireAuth`, send anonymous visitors to sign-in (draft preview exempt). */
export async function redirectIfPageRequiresAuth(args: {
  page: { requireAuth?: boolean | null } | null
  draft: boolean
  callbackPath: string
}): Promise<void> {
  const { page, draft, callbackPath } = args
  if (draft || !page?.requireAuth) return

  const session = await getSession()
  if (!session?.user) {
    redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackPath)}`)
  }
}
