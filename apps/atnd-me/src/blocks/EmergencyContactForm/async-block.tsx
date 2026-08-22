import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { currentUser, getSession } from '@/lib/auth/context/get-context-props'
import { findEmergencyContactForUser } from '@/lib/emergency-contacts/lookup'
import {
  initialPeopleForSession,
  parseEmergencyContactSessionUser,
} from '@/lib/emergency-contacts/resolve-session-user'
import { getPayload } from '@/lib/payload'
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

  const session = await getSession()
  const sessionUser = parseEmergencyContactSessionUser(session?.user ?? (await currentUser()))

  let initialPeople = null
  if (sessionUser) {
    const payload = await getPayload()
    const existing = await findEmergencyContactForUser(payload, sessionUser.id, tenantId)
    initialPeople = initialPeopleForSession(existing, sessionUser.name)
  }

  return (
    <EmergencyContactFormClient
      heading={props.heading}
      intro={props.intro as Parameters<typeof EmergencyContactFormClient>[0]['intro']}
      sessionUser={sessionUser}
      initialPeople={initialPeople}
    />
  )
}
