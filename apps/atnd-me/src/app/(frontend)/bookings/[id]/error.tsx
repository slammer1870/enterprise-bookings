'use client'

/**
 * Catches client-side errors in the booking page (e.g. payment component throws)
 * so we show a friendly message instead of the global "Something went wrong".
 */
import Link from 'next/link'

export default function BookingPageError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="container mx-auto max-w-screen-sm px-4 py-8 pt-24 min-h-screen flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Booking page error</h1>
      <p className="text-muted-foreground">
        Something went wrong loading this booking. You can try again or go back to the home page.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-md border border-input hover:bg-accent"
        >
          Home
        </Link>
      </div>
    </div>
  )
}
