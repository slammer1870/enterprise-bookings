import React from 'react'

import { ClHeroScheduleSanctuaryBlock } from '@repo/website/src/blocks/croi-lan-sauna/ClHeroScheduleSanctuary'
import { BlockBookingTheme } from '@/components/BlockBookingTheme'
import type { Location } from '@/payload-types'
import type { BookingThemeConfig } from '@/utilities/bookingThemeTypes'
import { ScheduleBlock } from '@/blocks/Schedule/Component'

type HeroScheduleSanctuaryBlockProps = Omit<
  React.ComponentProps<typeof ClHeroScheduleSanctuaryBlock>,
  'schedulePanel'
> & {
  id?: string | null
  bookingTheme?: BookingThemeConfig | null
  location?: ((number | null) | Location)[] | (number | null) | Location
}

function normalizeLocationField(
  location: HeroScheduleSanctuaryBlockProps['location'],
): ((number | null) | Location)[] {
  if (location == null) return []
  return Array.isArray(location) ? location : [location]
}

export async function HeroScheduleSanctuaryBlock({
  id,
  bookingTheme,
  location,
  ...props
}: HeroScheduleSanctuaryBlockProps) {
  return (
    <BlockBookingTheme scopeId={id} bookingTheme={bookingTheme}>
      <ClHeroScheduleSanctuaryBlock
        {...props}
        schedulePanel={
          <div className="w-full min-w-0">
            <ScheduleBlock
              allowedLocations={normalizeLocationField(location)}
              skipThemeWrapper
            />
          </div>
        }
      />
    </BlockBookingTheme>
  )
}
