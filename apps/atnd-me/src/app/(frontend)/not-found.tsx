import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * 404 Not Found page
 * Shows when:
 * - Invalid tenant subdomain is accessed
 * - Page doesn't exist
 * - Tenant doesn't exist
 */
export default async function NotFound() {
  const cookieStore = await cookies()
  const tenantSlug = cookieStore.get('tenant-slug')?.value
  const headersList = await headers()
  const hostname = headersList.get('host') || ''

  // If there's a tenant slug but we're showing 404, the tenant is invalid
  const isInvalidTenant = !!tenantSlug

  // Construct root domain URL (remove subdomain)
  let rootDomainUrl = '/'
  if (isInvalidTenant && hostname) {
    // Extract root domain from hostname
    // For localhost: remove subdomain (e.g., invalid.localhost:3000 -> localhost:3000)
    // For production: remove subdomain (e.g., invalid.example.com -> example.com)
    const isLocalhost = hostname.includes('localhost')
    
    if (isLocalhost) {
      const parts = hostname.split(':')
      const hostWithoutPort = parts[0] || ''
      const port = parts[1] || ''
      
      // Remove subdomain from localhost
      if (hostWithoutPort.includes('.')) {
        const hostParts = hostWithoutPort.split('.')
        // Find 'localhost' in the parts
        const localhostIndex = hostParts.findIndex(p => p === 'localhost')
        if (localhostIndex >= 0) {
          const rootHost = hostParts.slice(localhostIndex).join('.')
          rootDomainUrl = `http://${rootHost}${port ? `:${port}` : ''}`
        } else {
          rootDomainUrl = `http://localhost${port ? `:${port}` : ''}`
        }
      } else {
        rootDomainUrl = `http://${hostname}`
      }
    } else {
      // For production domains, remove first part (subdomain)
      const parts = hostname.split('.')
      if (parts.length >= 3) {
        // Remove subdomain (first part)
        const rootDomain = parts.slice(1).join('.')
        rootDomainUrl = `https://${rootDomain}`
      } else {
        // Already root domain
        rootDomainUrl = `https://${hostname}`
      }
    }
  }

  // For root domain, use relative URLs
  const homeUrl = isInvalidTenant ? `${rootDomainUrl}/` : '/'
  const tenantsUrl = isInvalidTenant ? `${rootDomainUrl}/tenants` : '/tenants'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-6xl font-bold mb-4 text-gray-900">404</h1>
        
        {isInvalidTenant ? (
          <>
            <h2 className="text-3xl font-semibold mb-4 text-gray-700">
              Tenant Not Found
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              The tenant &quot;{tenantSlug}&quot; does not exist or is not available.
            </p>
            <div className="space-x-4">
              <a
                href={homeUrl}
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Go to Home
              </a>
              <a
                href={tenantsUrl}
                className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                View All Tenants
              </a>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-semibold mb-4 text-gray-700">
              Page Not Found
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              The page you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link
              href="/"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Go to Home
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
