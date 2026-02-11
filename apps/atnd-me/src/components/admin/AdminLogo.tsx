import { TenantBranding } from './TenantBranding'

type AdminLogoProps = {
  payload: { find: (opts: unknown) => Promise<{ docs: unknown[] }> }
}

/**
 * Full logo for Payload admin (login view, etc.).
 * Uses tenant logo when payload-tenant (TenantSelector) or tenant-slug (subdomain) is set and tenant has a logo.
 */
export default async function AdminLogo({ payload }: AdminLogoProps) {
  return <TenantBranding payload={payload} variant="logo" />
}
