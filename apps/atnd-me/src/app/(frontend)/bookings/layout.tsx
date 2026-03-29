import type { ReactNode } from 'react'

/**
 * Booking layout. Child routes use dynamic server APIs (session, headers, tRPC caller).
 */
export const dynamic = 'force-dynamic'

export default function BookingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
