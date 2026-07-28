import React from 'react'

import { EventDetailView } from '@/components/events/EventDetailView'
import { loadEventTimeslot } from '@/components/events/loadEventTimeslot'
import { relationId } from '@/components/events/eventPageTypes'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'
import type { Media } from '@/payload-types'

type EventBlockProps = {
  timeslot?: number | { id?: number | null } | null
  coverImage?: (number | null) | Media
  about?: DefaultTypedEditorState | null
  mapUrl?: string | null
  blockType?: 'event'
}

export async function EventBlock({
  timeslot: timeslotRef,
  coverImage,
  about,
  mapUrl,
}: EventBlockProps) {
  const id = relationId(timeslotRef)
  if (id == null) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        Select a timeslot for this event block.
      </p>
    )
  }

  const timeslot = await loadEventTimeslot(id)
  if (!timeslot) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        This event is unavailable or no longer active.
      </p>
    )
  }

  return (
    <EventDetailView
      timeslot={timeslot}
      coverImage={coverImage}
      about={about}
      mapUrl={mapUrl}
    />
  )
}
