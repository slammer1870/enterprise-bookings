import { TenantBranding } from './TenantBranding'

type AdminIconProps = {
  payload: { find: (opts: unknown) => Promise<{ docs: unknown[] }> }
}

/**
 * Small icon for Payload admin (nav sidebar, etc.).
 * Uses tenant logo when payload-tenant (TenantSelector) or tenant-slug (subdomain) is set and tenant has a logo.
 */
export default async function AdminIcon({ payload }: AdminIconProps) {
  return <TenantBranding payload={payload} variant="icon" />
}
