/**
 * Step 6 – Class pass purchase page (minimal).
 * Requires auth; tenant from cookie (tenant-slug). Uses POST /api/class-passes/purchase + Stripe Elements.
 */
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getSession } from '@/lib/auth/context/get-context-props'
import { ClassPassPurchaseForm } from '@/components/class-pass/ClassPassPurchaseForm'
import Link from 'next/link'
import { getTenantSlug } from '@/utilities/getTenantContext'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ClassPassPurchasePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  if (params.success === '1') {
    return (
      <div className="container max-w-md py-8">
        <p className="text-lg font-medium">Payment successful.</p>
        <p className="text-muted-foreground mt-1">Your class pass is ready to use.</p>
        <Link href="/" className="mt-4 inline-block text-primary underline">
          Back to home
        </Link>
      </div>
    )
  }
  const session = await getSession()
  if (!session?.user) {
    redirect(
      `/complete-booking?mode=login&callbackUrl=${encodeURIComponent('/class-passes/purchase')}`,
    )
  }

  const cookieStore = await cookies()
  const headersList = await headers()
  const tenantSlug = await getTenantSlug({ cookies: cookieStore, headers: headersList })

  if (!tenantSlug) {
    return (
      <div className="container max-w-md py-8">
        <p className="text-muted-foreground">
          Select a tenant (or open this page from a tenant subdomain) to buy a class pass.
        </p>
        <Link href="/" className="mt-2 inline-block text-primary underline">
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <div className="container max-w-md py-8">
      <ClassPassPurchaseForm defaultQuantity={1} />
    </div>
  )
}
