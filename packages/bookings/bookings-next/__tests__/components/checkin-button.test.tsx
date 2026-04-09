import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CheckInButton } from '../../src/components/timeslots/checkin-button'
import { toast } from 'sonner'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@repo/trpc/client', () => ({
  useTRPC: () => ({
    bookings: {
      setMyBookingForTimeslot: { mutationOptions: (opts: any) => opts },
      bookSingleSlotTimeslotOrRedirect: { mutationOptions: (opts: any) => opts },
    },
    timeslots: {
      getByDate: { queryKey: () => ['timeslots.getByDate'] },
    },
  }),
}))

const invalidateQueriesMock = vi.fn(async () => {})
let nextRedirectUrl: string | null = null
vi.mock('@tanstack/react-query', async () => {
  const actual: any = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
    useMutation: (opts: any) => {
      return {
        mutateAsync: async (input: any) => {
          if (typeof opts?.onSuccess === 'function') {
            // Simulate server returning "no redirect" (direct booking succeeded)
            await opts.onSuccess({ redirectUrl: nextRedirectUrl }, input, null)
          }
          return { redirectUrl: nextRedirectUrl }
        },
        isPending: false,
      }
    },
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn() },
}))

vi.mock('@repo/ui/components/ui/use-confirm', () => ({
  useConfirm: () => [() => null, async () => true],
}))

describe('CheckInButton (schedule single-slot shortcut)', () => {
  beforeEach(() => {
    invalidateQueriesMock.mockClear()
    ;(toast.success as any).mockClear?.()
    nextRedirectUrl = null
  })

  it('attempts direct booking when scheduleState.singleSlotOnly is true', async () => {
    const user = userEvent.setup()

    render(
      <CheckInButton
        timeslotId={123}
        type="adult"
        scheduleState={{
          availability: 'open',
          viewer: { confirmedIds: [], confirmedCount: 0, waitingIds: [], waitingCount: 0 },
          action: 'book',
          label: 'Book',
          singleSlotOnly: true,
        }}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Book' }))

    expect(invalidateQueriesMock).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Booked')
  })

  it('does not show "Booked" toast when server returns a redirectUrl', async () => {
    nextRedirectUrl = '/bookings/123'
    const user = userEvent.setup()

    render(
      <CheckInButton
        timeslotId={123}
        type="adult"
        scheduleState={{
          availability: 'open',
          viewer: { confirmedIds: [], confirmedCount: 0, waitingIds: [], waitingCount: 0 },
          action: 'book',
          label: 'Book',
          singleSlotOnly: true,
        }}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Book' }))

    expect(invalidateQueriesMock).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalledWith('Booked')
  })
})

