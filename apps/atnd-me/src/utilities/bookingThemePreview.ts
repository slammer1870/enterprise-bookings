import type { BookingThemeStateKey } from '@/utilities/bookingThemeTypes'

export const BOOKING_BUTTON_PREVIEW_LABELS: Record<BookingThemeStateKey, string> = {
  checkin: 'Book',
  trialable: 'Trial class',
  cancel: 'Cancel',
  waitlist: 'Waitlist',
  childrenBooked: 'Manage children',
  modify: 'Modify',
  closed: 'Closed',
}

/** Platform defaults from @repo/ui — used in admin preview when tenant fields are empty. */
export const PLATFORM_BOOKING_THEME_COLORS: Record<
  BookingThemeStateKey,
  { backgroundColor: string; foregroundColor: string }
> = {
  checkin: { backgroundColor: 'green-600', foregroundColor: 'white' },
  trialable: { backgroundColor: 'blue-500', foregroundColor: 'white' },
  cancel: { backgroundColor: 'red-500', foregroundColor: 'white' },
  waitlist: { backgroundColor: 'amber-500', foregroundColor: 'white' },
  childrenBooked: { backgroundColor: 'purple-400', foregroundColor: 'white' },
  modify: { backgroundColor: 'violet-600', foregroundColor: 'white' },
  closed: { backgroundColor: 'gray-500', foregroundColor: 'white' },
}
