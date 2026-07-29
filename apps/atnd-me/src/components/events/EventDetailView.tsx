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
  const timeLabel = `${formatInTimeZone(timeslot.startTime, 'h:mm a', timeZone)} – ${formatInTimeZone(timeslot.endTime, 'h:mm a', timeZone)}`

  const staffImage =
    staff?.profileImage && typeof staff.profileImage === 'object'
      ? (staff.profileImage as Media)
      : null

  const aboutRichText = aboutProp ?? null
  // Event type description often gets filled with the same string as the name in admin —
  // don't echo the title again in the body.
  const aboutFallbackRaw =
    typeof eventType?.description === 'string' ? eventType.description.trim() : ''
  const aboutFallback =
    aboutFallbackRaw && aboutFallbackRaw.toLowerCase() !== title.trim().toLowerCase()
      ? aboutFallbackRaw
      : null

  const hasAbout = Boolean(aboutRichText) || Boolean(aboutFallback)

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

  const placesLabel =
    remaining <= 0
      ? 'Sold out'
      : remaining === 1
        ? '1 place left'
        : `${remaining} places left`

  return (
    <div className="space-y-6 pt-8 pb-8 md:pt-10">
      <header className="space-y-4">
        {coverUrl ? (
          <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl md:aspect-[3/1]">
            <Image
              src={coverUrl}
              alt={cover?.alt || title}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
              priority
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">{dateLabel}</span>
            <span className="mx-2 text-muted-foreground/50" aria-hidden>
              ·
            </span>
            <span>{timeLabel}</span>
          </p>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted-foreground">
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
              {placesLabel}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_auto] lg:gap-8">
        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          {staff?.name ? (
            <HostedBy
              name={staff.name}
              description={staff.description}
              imageUrl={mediaUrl(staffImage)}
              imageAlt={staffImage?.alt || staff.name}
            />
          ) : null}

          {hasAbout ? (
            <section>
              {aboutRichText ? (
                <RichText data={aboutRichText} enableGutter={false} />
              ) : (
                <p className="whitespace-pre-wrap text-muted-foreground">{aboutFallback}</p>
              )}
            </section>
          ) : null}
        </div>

        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start lg:sticky lg:top-24">
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
            <h2 className="mb-3 text-xl font-semibold text-foreground">Location</h2>
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
