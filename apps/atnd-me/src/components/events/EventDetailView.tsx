import Image from 'next/image'
import { formatInTimeZone, resolveTimeZone } from '@repo/shared-utils/timezone'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

import { currentUser } from '@/lib/auth/context/get-context-props'
import RichText from '@/components/RichText'
import { MapBlock } from '@/blocks/Map/Component'
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
import { resolveGoogleMapsEmbed } from '@/utilities/resolveGoogleMapsEmbedUrl'

type EventDetailViewProps = {
  timeslot: EventPageTimeslot
  coverImage?: (number | null) | Media
  about?: DefaultTypedEditorState | null
  mapUrl?: string | null
}

export async function EventDetailView({
  timeslot,
  coverImage: coverImageProp,
  about: aboutProp,
  mapUrl,
}: EventDetailViewProps) {
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
  const cover =
    coverImageProp && typeof coverImageProp === 'object' ? (coverImageProp as Media) : null
  const coverUrl = mediaUrl(cover)
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

  const aboutRichText = aboutProp ?? null
  const aboutFallback =
    typeof eventType?.description === 'string' ? eventType.description : null

  const mapFromUrl = typeof mapUrl === 'string' ? mapUrl.trim() : ''
  const mapFromBranch = loc?.address || loc?.name || ''
  const resolvedMapUrl = mapFromUrl || mapFromBranch || null
  const mapsEmbed = resolvedMapUrl ? await resolveGoogleMapsEmbed(resolvedMapUrl) : null
  // Prefer the business name from the pasted Maps link; fall back to branch name.
  const mapCaption =
    (mapFromUrl ? mapsEmbed?.placeName : null) ||
    loc?.name ||
    mapsEmbed?.placeName ||
    loc?.address ||
    null

  const serializableTimeslot = JSON.parse(JSON.stringify(timeslot))

  return (
    <div className="space-y-10 pt-24 pb-8 md:pt-28 lg:pt-32">
      <header className="space-y-6">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl md:aspect-[21/9]">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={cover?.alt || title}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900" />
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {dateLabel}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold text-foreground md:text-5xl">{title}</h1>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">{timeLabel}</p>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_auto]">
        <div className="space-y-10 lg:col-start-1 lg:row-start-1">
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
            {aboutRichText ? (
              <RichText data={aboutRichText} enableGutter={false} />
            ) : aboutFallback ? (
              <p className="whitespace-pre-wrap text-muted-foreground">{aboutFallback}</p>
            ) : (
              <p className="text-muted-foreground">Details coming soon.</p>
            )}
          </section>
        </div>

        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start lg:sticky lg:top-28">
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

        {resolvedMapUrl ? (
          <section className="lg:col-start-1 lg:row-start-2">
            <h2 className="mb-4 text-2xl font-semibold text-foreground">Location</h2>
            <MapBlock
              mapUrl={resolvedMapUrl}
              embedSrc={mapsEmbed?.embedSrc}
              placeName={mapsEmbed?.placeName}
              caption={mapCaption}
              className="my-0 not-prose w-full"
            />
          </section>
        ) : null}
      </div>
    </div>
  )
}
