import React from 'react'
import Image from 'next/image'
import { cookies } from 'next/headers'

import { getTenantWithBranding } from '@/utilities/getTenantContext'

const DEFAULT_PAYLOAD_LOGO =
  'https://raw.githubusercontent.com/payloadcms/payload/main/packages/ui/src/assets/payload-logo-light.svg'

type TenantBrandingProps = {
  payload: { find: (opts: unknown) => Promise<{ docs: unknown[] }> }
  variant: 'logo' | 'icon'
  className?: string
}

/**
 * Server component that renders tenant logo when available, otherwise Payload default.
 * Used for admin graphics.Logo and graphics.Icon.
 * Tenant is resolved from payload-tenant (TenantSelector) or tenant-slug (subdomain) cookie.
 */
export async function TenantBranding({ payload, variant, className }: TenantBrandingProps) {
  let logoUrl: string | null = null
  let logoAlt = 'Logo'

  try {
    const cookieStore = await cookies()
    const tenant = await getTenantWithBranding(
      payload as Parameters<typeof getTenantWithBranding>[0],
      { cookies: cookieStore },
    )
    if (tenant?.logo && typeof tenant.logo === 'object' && tenant.logo !== null && 'url' in tenant.logo) {
      logoUrl = typeof tenant.logo.url === 'string' ? tenant.logo.url : null
      logoAlt = (tenant.logo as { alt?: string }).alt || tenant.name || 'Logo'
    }
  } catch {
    // Fall through to default
  }

  const src = logoUrl || DEFAULT_PAYLOAD_LOGO
  const alt = logoUrl ? logoAlt : 'Payload'

  const isExternal = src === DEFAULT_PAYLOAD_LOGO

  if (variant === 'icon') {
    return (
      <Image
        src={src}
        alt={alt}
        width={24}
        height={24}
        className={className}
        style={{ objectFit: 'contain' }}
        unoptimized={isExternal}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={193}
      height={34}
      className={className}
      style={{ maxWidth: '9.375rem', width: '100%', height: 34, objectFit: 'contain' }}
      unoptimized={isExternal}
    />
  )
}
