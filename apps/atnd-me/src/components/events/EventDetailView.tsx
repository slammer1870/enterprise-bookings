import { formatInTimeZone, resolveTimeZone } from '@repo/shared-utils/timezone'

import { currentUser } from '@/lib/auth/context/get-context-props'
import { LocationBlock } from '@repo/website/src/blocks/location'
import { HostedBy } from '@/components/events/HostedBy'
import { EventTicketPanel } from '@/components/events/EventTicketPanel'
import { EventAuthenticatedCheckout } from '@/components/events/EventAuthenticatedCheckout.client'
import {
  type EventPageTimeslot,
  mediaUrl,
  locationAddress,
  resolveDropInFromEventType,
} from '@/components/events/eventPageTypes'
import type { EventType, StaffMember, Media, Tenant } from '@/payload-types'

type EventDetailViewProps = {
  timeslot: EventPageTimeslot
}

export async function EventDetailView({ timeslot }: EventDetailViewProps) {
  const tenantFromRelation =
    typeof timeslot.tenant === 'object' && timeslot.tenant
      ? (timeslot.tenant as Tenant)
      : null
  const branch =
    typeof timeslot.branch === 'object' && timeslot.branch ? timeslot.branch : null
  const timeZone = resolveTimeZone(
    branch?.timeZone || tenantFromRelation?.timeZone || undefined,
  )

  const eventType =
    typeof timeslot.eventType === 'object' ? (timeslot.eventType as EventType) : null
  const staff =
    typeof timeslot.staffMember === 'object' && timeslot.staffMember
      ? (timeslot.staffMember as StaffMember)
      : null
  const loc = locationAddress(branch)
  const dropIn = resolveDropInFromEventType(eventType)
  const remaining = typeof timeslot.remainingCapacity === 'number' ? timeslot.remainingCapacity : 0

  const endMs = Date.parse(timeslot.endTime)
  const isPast = Number.isFinite(endMs) ? endMs < Date.now() : false

  const user = await currentUser()
  const isAuthenticated = Boolean(user?.id)

  const title = eventType?.name || 'Event'
  const dateLabel = formatInTimeZone(timeslot.startTime, 'EEEE, d MMMM yyyy', timeZone)
  const timeLabel = `${formatInTimeZone(timeslot.startTime, 'HH:mm', timeZone)} – ${formatInTimeZone(timeslot.endTime, 'HH:mm', timeZone)}`

  const staffImage =
    staff?.profileImage && typeof staff.profileImage === 'object'
      ? (staff.profileImage as Media)
      : null

  const aboutFallback =
    typeof eventType?.description === 'string' ? eventType.description : null

  const serializableTimeslot = JSON.parse(JSON.stringify(timeslot))

  return (
    <div className="space-y-10 py-8">
      <section className="relative flex min-h-[36vh] w-full items-end overflow-hidden rounded-2xl md:min-h-[44vh]">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900" />
        <div className="relative z-10 w-full px-6 pb-8 pt-20 md:px-10 md:pb-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-white/80">
            {dateLabel}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold text-white drop-shadow-md md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-base text-white/90 md:text-lg">{timeLabel}</p>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {loc ? <span>{loc.name}</span> : null}
            {timeslot.location ? <span>{timeslot.location}</span> : null}
            <span
              className={
                remaining > 0 && remaining <= 6
                  ? 'font-medium text-amber-700 dark:text-amber-400'
                  : ''
              }
              data-testid="event-meta-places"
            >
              {remaining <= 0
                ? 'Sold out'
                : remaining === 1
                  ? '1 place left'
                  : `${remaining} places left`}
            </span>
          </div>

          {staff?.name ? (
            <HostedBy
              name={staff.name}
              description={staff.description}
              imageUrl={mediaUrl(staffImage)}
              imageAlt={staffImage?.alt || staff.name}
            />
          ) : null}

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">About event</h2>
            {aboutFallback ? (
              <p className="whitespace-pre-wrap text-muted-foreground">{aboutFallback}</p>
            ) : (
              <p className="text-muted-foreground">Details coming soon.</p>
            )}
          </section>

          {loc ? (
            <LocationBlock
              title="Location"
              address={loc.address || loc.name}
              description={loc.name}
            />
          ) : null}
        </div>

        <div>
          <EventTicketPanel
            timeslot={serializableTimeslot}
            dropIn={
              dropIn ?? {
                id: 0,
                price: 0,
                maxBookingsPerTimeslot: 1,
                discountTiers: null,
              }
            }
            remainingCapacity={remaining}
            isAuthenticated={isAuthenticated}
            isPast={isPast}
            successUrl="/success"
            AuthenticatedCheckout={EventAuthenticatedCheckout}
          />
        </div>
      </div>
    </div>
  )
}
