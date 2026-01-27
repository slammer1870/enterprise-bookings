import Link from 'next/link'

import { getPayload } from '@/lib/payload'
import type { Tenant } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Tenants listing page - shows all available tenants
 * Public access, no tenant context required
 */
export default async function TenantsPage() {
  const payload = await getPayload()
  
  // Query all tenants (public read access)
  const tenantsResult = await payload.find({
    collection: 'tenants',
    limit: 100,
    depth: 1, // Populate logo relationship
    overrideAccess: false, // Use access control (public read is allowed)
    sort: 'name',
  })

  const tenants = tenantsResult.docs as Tenant[]
  const baseUrl = getServerSideURL()
  
  // Extract domain from base URL for subdomain construction
  const url = new URL(baseUrl)
  const domain = url.hostname
  const isLocalhost = domain.includes('localhost')
  const protocol = url.protocol

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 text-gray-900">
              Available Tenants
            </h1>
            <p className="text-xl text-gray-600">
              Choose a tenant to view their classes and book sessions
            </p>
          </div>

          {tenants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                No tenants available at this time.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenants.map((tenant) => {
                // Construct subdomain URL
                const subdomainUrl = isLocalhost
                  ? `${protocol}//${tenant.slug}.${domain}${url.port ? `:${url.port}` : ''}`
                  : `${protocol}//${tenant.slug}.${domain}`
                
                const logo = typeof tenant.logo === 'object' && tenant.logo !== null
                  ? tenant.logo
                  : null

                return (
                  <div
                    key={tenant.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {logo && typeof logo === 'object' && 'url' in logo && (
                      <div className="h-48 bg-gray-200 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={typeof logo.url === 'string' ? logo.url : ''}
                          alt={tenant.name}
                          className="max-h-full max-w-full object-contain p-4"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <h2 className="text-2xl font-semibold mb-2 text-gray-900">
                        {tenant.name}
                      </h2>
                      {tenant.description && (
                        <p className="text-gray-600 mb-4 line-clamp-3">
                          {tenant.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {tenant.slug}
                        </span>
                        <Link
                          href={subdomainUrl}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                          Visit →
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="text-blue-600 hover:underline"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
