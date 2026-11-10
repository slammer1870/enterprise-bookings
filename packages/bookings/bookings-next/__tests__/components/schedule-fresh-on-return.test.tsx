import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ScheduleTimeslot } from '@repo/shared-types'

import { Schedule } from '../../src/components/schedule'

const SCHEDULE_KEY = ['timeslots', 'getByDate']

const { fetchSchedule } = vi.hoisted(() => ({
  fetchSchedule: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@repo/ui/components/ui/use-confirm', () => ({
  useConfirm: () => [() => null, async () => true],
}))

vi.mock('@repo/trpc/client', () => ({
  useTRPC: () => ({
    timeslots: {
      getByDate: {
        queryKey: () => SCHEDULE_KEY,
        queryOptions: () => ({
          queryKey: SCHEDULE_KEY,
          queryFn: fetchSchedule,
        }),
      },
    },
    bookings: {
      setMyBookingForTimeslot: { mutationOptions: (opts: unknown) => opts },
      bookSingleSlotTimeslotOrRedirect: { mutationOptions: (opts: unknown) => opts },
      getCancelRefundPreview: {
        queryOptions: () => ({ queryKey: ['cancel-preview'], queryFn: async () => ({}) }),
      },
    },
  }),
}))

function timeslot(action: 'book' | 'cancel', label: string): ScheduleTimeslot {
  const now = new Date().toISOString()
  return {
    id: 42,
    date: now,
    startTime: now,
    endTime: now,
    location: 'Main',
    branch: 1,
    tenant: 1,
    timeZone: 'Europe/Dublin',
    remainingCapacity: 4,
    bookingStatus: action === 'cancel' ? 'booked' : 'active',
    myBookingCount: action === 'cancel' ? 1 : 0,
    eventType: { id: 7, name: 'Noon class', type: 'adult' },
    scheduleState: {
      availability: 'open',
      action,
      label,
      singleSlotOnly: true,
      viewer: {
        confirmedIds: action === 'cancel' ? [9] : [],
        confirmedCount: action === 'cancel' ? 1 : 0,
        waitingIds: [],
        waitingCount: 0,
      },
    },
  }
}

function renderSchedule(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Schedule />
    </QueryClientProvider>,
  )
}

function scheduleElement(queryClient: QueryClient) {
  return (
    <QueryClientProvider client={queryClient}>
      <Schedule />
    </QueryClientProvider>
  )
}

function cachedSchedule() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(SCHEDULE_KEY, [timeslot('book', 'Book')])
  return queryClient
}

function deferredSchedule() {
  let resolveSchedule: (rows: ScheduleTimeslot[]) => void = () => {}
  fetchSchedule.mockImplementation(
    () =>
      new Promise<ScheduleTimeslot[]>((resolve) => {
        resolveSchedule = resolve
      }),
  )
  return (rows: ScheduleTimeslot[]) => resolveSchedule(rows)
}

describe('Schedule after returning home', () => {
  beforeEach(() => {
    fetchSchedule.mockReset()
  })

  it('does not paint a cached Book button from the server snapshot', async () => {
    const resolveSchedule = deferredSchedule()
    const queryClient = cachedSchedule()
    const view = scheduleElement(queryClient)

    const previousWindow = globalThis.window
    vi.stubGlobal('window', undefined)
    let html = ''
    try {
      html = renderToString(view)
    } finally {
      vi.stubGlobal('window', previousWindow)
    }

    expect(html).toContain('Loading schedule')
    expect(html).not.toContain('Book')

    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    let root: Root | undefined
    await act(async () => {
      root = hydrateRoot(container, scheduleElement(queryClient))
    })

    expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument()
    expect(screen.getByText(/loading schedule/i)).toBeInTheDocument()

    await act(async () => {
      resolveSchedule([timeslot('cancel', 'Cancel Booking')])
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel Booking' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument()

    await act(async () => {
      root?.unmount()
    })
    container.remove()
  })

  it('does not paint a cached Book button before this visit has loaded the schedule', async () => {
    const resolveSchedule = deferredSchedule()

    renderSchedule(cachedSchedule())

    expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument()
    expect(screen.getByText(/loading schedule/i)).toBeInTheDocument()

    resolveSchedule([timeslot('cancel', 'Cancel Booking')])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel Booking' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument()
  })

  it('does not paint a cached Book button when this visit fails to load the schedule', async () => {
    fetchSchedule.mockRejectedValue(new Error('offline'))

    renderSchedule(cachedSchedule())

    await waitFor(() => {
      expect(screen.getByText(/couldn't load the schedule/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument()
  })

  it('hides a restored Book button until the back-forward cache refetch finishes', async () => {
    const resolveFirst = deferredSchedule()
    renderSchedule(cachedSchedule())
    resolveFirst([timeslot('book', 'Book')])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Book' })).toBeInTheDocument()
    })

    let resolveRestored: (rows: ScheduleTimeslot[]) => void = () => {}
    fetchSchedule.mockImplementation(
      () =>
        new Promise<ScheduleTimeslot[]>((resolve) => {
          resolveRestored = resolve
        }),
    )

    const pageshow = new Event('pageshow')
    Object.defineProperty(pageshow, 'persisted', { value: true })
    act(() => {
      window.dispatchEvent(pageshow)
    })

    await waitFor(() => {
      expect(screen.getByText(/loading schedule/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument()

    resolveRestored([timeslot('cancel', 'Cancel Booking')])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel Booking' })).toBeInTheDocument()
    })
  })

  it('does not paint a restored Book button when the back-forward refetch fails', async () => {
    const resolveFirst = deferredSchedule()
    renderSchedule(cachedSchedule())
    resolveFirst([timeslot('book', 'Book')])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Book' })).toBeInTheDocument()
    })

    fetchSchedule.mockRejectedValue(new Error('offline'))

    const pageshow = new Event('pageshow')
    Object.defineProperty(pageshow, 'persisted', { value: true })
    act(() => {
      window.dispatchEvent(pageshow)
    })

    await waitFor(() => {
      expect(screen.getByText(/couldn't load the schedule/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument()
  })
})
