import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

/**
 * Admin layout that protects all admin routes
 * Only users with 'admin' role can access the admin panel
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const payload = await getPayload({ config })
  const requestHeaders = await headers()

  // Get current user from Payload auth
  const { user } = await payload.auth({ headers: requestHeaders })

  // If no user or user is not admin, redirect to home
  if (!user || !checkRole(['admin'], user as unknown as SharedUser)) {
    redirect('/')
  }

  return <>{children}</>
}
