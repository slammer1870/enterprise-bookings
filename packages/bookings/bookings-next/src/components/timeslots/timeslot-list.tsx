import { ScheduleTimeslot } from '@repo/shared-types'

import type { LoginToBookUrlResolver } from './checkin-button'
import { TimeslotDetail } from './timeslot-detail'

export function TimeslotList({ 
  timeslots,
  manageHref,
  loginToBookUrl,
}: { 
  timeslots: ScheduleTimeslot[];
  /**
   * Optional function or string to generate the manage booking URL.
   * Defaults to `/bookings/[id]/manage` if not provided.
   * Passed through to TimeslotDetail components.
   */
  manageHref?: string | ((timeslotId: number) => string);
  loginToBookUrl?: LoginToBookUrlResolver;
}) {
  return (
    <div className="flex flex-col gap-4 md:gap-8 w-full">
      {timeslots && timeslots?.length > 0 ? (
        timeslots?.map((timeslot) => (
          <TimeslotDetail
            key={timeslot.id}
            timeslot={timeslot}
            manageHref={manageHref}
            loginToBookUrl={loginToBookUrl}
          />
        ))
      ) : (
        <p className="text-muted-foreground">No timeslots scheduled for today</p>
      )}
    </div>
  )
}

