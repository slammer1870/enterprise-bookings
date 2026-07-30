import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { EmergencyContactFormClient } from './EmergencyContactForm.client'

type EmergencyContactFormBlockProps = {
  heading?: string | null
  intro?: unknown
}

export async function EmergencyContactFormAsync(props: EmergencyContactFormBlockProps) {
  const tenantId = await resolveTenantIdFromServerContext()

  if (tenantId == null) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Emergency contacts are unavailable: no tenant context for this page.
      </p>
    )
  }

  return (
    <EmergencyContactFormClient
      heading={props.heading}
      intro={props.intro as Parameters<typeof EmergencyContactFormClient>[0]['intro']}
    />
  )
}
