import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CheckInButton } from '../../src/components/lessons/checkin-button'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@repo/trpc/client', () => ({
  useTRPC: () => ({
    bookings: {
      setMyBookingForLesson: { mutationOptions: (opts: any) => opts },
      bookSingleSlotLessonOrRedirect: { mutationOptions: (opts: any) => opts },
    },
    lessons: {
      getByDate: { queryKey: () => ['lessons.getByDate'] },
    },
  }),
}))

const invalidateQueriesMock = vi.fn(async () => {})
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
            await opts.onSuccess({ redirectUrl: null }, input, null)
          }
          return { redirectUrl: null }
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
  })

  it('attempts direct booking when scheduleState.singleSlotOnly is true', async () => {
    const user = userEvent.setup()

    render(
      <CheckInButton
        lessonId={123}
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
  })
})

