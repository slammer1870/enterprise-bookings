import { notFound } from 'next/navigation'

/**
 * Intentionally disabled to prevent tenant enumeration.
 */
export default async function TenantsPage() {
  notFound()
}
