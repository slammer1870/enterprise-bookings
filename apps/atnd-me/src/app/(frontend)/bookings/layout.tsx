import React from 'react'

/**
 * Booking routes use getSession()/headers() and createCaller().
 * Force dynamic so we avoid DYNAMIC_SERVER_USAGE in production/E2E.
 */
export const dynamic = 'force-dynamic'

export default function BookingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
