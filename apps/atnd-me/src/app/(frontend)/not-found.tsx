import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { getTenantSlug } from '@/utilities/getTenantContext'
import { getRequestHostname } from '@/utilities/tenantRequest'

/**
 * 404 Not Found page
 * Shows when:
 * - Invalid tenant subdomain is accessed
 * - Page doesn't exist
 * - Tenant doesn't exist
 */
export default async function NotFound() {
  const cookieStore = await cookies()
  const headersList = await headers()
  const tenantSlug = await getTenantSlug({ cookies: cookieStore, headers: headersList })
  const hostname = getRequestHostname(headersList) ?? ''

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

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>

        <h2 className="text-3xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-xl text-muted-foreground mb-8">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>

        {isInvalidTenant ? (
          <a
            href={homeUrl}
            className="inline-flex items-center justify-center rounded-lg text-lg font-semibold px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background transition-colors"
          >
            Go to Home
          </a>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg text-lg font-semibold px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background transition-colors"
          >
            Go to Home
          </Link>
        )}
      </div>
    </div>
  )
}
