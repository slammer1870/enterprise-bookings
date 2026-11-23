import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/context/get-context-props'

import { MyClassPassesList } from './MyClassPassesList.client'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{ purchased?: string | string[] }>
}

export default async function MyClassPassesPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user) {
    redirect(`/auth/sign-in?redirectTo=${encodeURIComponent('/class-passes')}`)
  }

  const resolved = (await searchParams) ?? {}
  const purchasedRaw = resolved.purchased
  const purchased =
    purchasedRaw === '1' ||
    purchasedRaw === 'true' ||
    (Array.isArray(purchasedRaw) && purchasedRaw.includes('1'))

  return (
    <div className="container mx-auto pt-24 pb-16">
      <div className="w-full">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Class Passes</h1>
        <p className="mt-2 text-muted-foreground">
          View your purchased class passes and remaining credits.
        </p>

        {purchased ? (
          <p
            className="mt-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground"
            data-testid="class-pass-purchase-success"
            role="status"
          >
            Purchase successful. Your new class pass should appear below shortly.
          </p>
        ) : null}

        <MyClassPassesList />
      </div>
    </div>
  )
}
