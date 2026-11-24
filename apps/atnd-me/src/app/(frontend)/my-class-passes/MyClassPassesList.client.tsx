'use client'

import { useTRPC } from '@repo/trpc/client'
import { useInfiniteQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'

const PAGE_SIZE = 10

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function statusLabel(status: string | null): string {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function MyClassPassesList() {
  const trpc = useTRPC()
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(
    trpc.bookings.listMyClassPasses.infiniteQueryOptions(
      { limit: PAGE_SIZE },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  )

  if (isLoading) {
    return <p className="mt-8 text-sm text-muted-foreground">Loading your class passes…</p>
  }

  if (error) {
    return (
      <p className="mt-8 text-sm text-destructive" role="alert">
        {error.message || 'Failed to load class passes'}
      </p>
    )
  }

  const passes = data?.pages.flatMap((page) => page.items) ?? []

  if (passes.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted-foreground" data-testid="my-class-passes-empty">
        You don&apos;t have any class passes yet.
      </p>
    )
  }

  return (
    <div className="mt-8 w-full">
      <ul
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="my-class-passes-list"
      >
        {passes.map((pass) => {
          const poolSummary =
            Array.isArray(pass.eventTypeOverrides) && pass.eventTypeOverrides.length > 0
              ? pass.eventTypeOverrides
                  .filter((row) => typeof row.quantity === 'number')
                  .map((row) => `${row.quantity} in pool`)
                  .join(' · ')
              : null

          return (
            <li
              key={pass.id}
              className="flex flex-col rounded-xl border border-border px-4 py-4"
              data-testid="my-class-pass-item"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">{pass.typeName}</h2>
                <span className="text-sm text-muted-foreground">{statusLabel(pass.status)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {pass.quantity} credit{pass.quantity === 1 ? '' : 's'} remaining
                {poolSummary ? ` · ${poolSummary}` : null}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Expires {formatDate(pass.expirationDate)}
                {pass.purchasedAt ? ` · Purchased ${formatDate(pass.purchasedAt)}` : null}
              </p>
            </li>
          )
        })}
      </ul>

      {hasNextPage ? (
        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            className="w-full cursor-pointer sm:w-auto"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
            data-testid="my-class-passes-load-more"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
