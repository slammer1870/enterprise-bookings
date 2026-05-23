import type { Tenant } from '@/payload-types'

export const BOOKING_THEME_STATE_KEYS = [
  'checkin',
  'trialable',
  'cancel',
  'waitlist',
  'childrenBooked',
  'modify',
  'closed',
] as const

export type BookingThemeStateKey = (typeof BOOKING_THEME_STATE_KEYS)[number]

export type TenantBookingTheme = NonNullable<Tenant['bookingTheme']>
export type BookingThemeButtonColors = NonNullable<TenantBookingTheme['checkin']>

/** Maps tenant bookingTheme field keys to CSS custom property names. */
export const BOOKING_THEME_CSS_VARS: Record<
  BookingThemeStateKey,
  { background: string; foreground: string }
> = {
  checkin: { background: '--checkin', foreground: '--checkin-foreground' },
  trialable: { background: '--trialable', foreground: '--trialable-foreground' },
  cancel: { background: '--cancel', foreground: '--cancel-foreground' },
  waitlist: { background: '--waitlist', foreground: '--waitlist-foreground' },
  childrenBooked: {
    background: '--children-booked',
    foreground: '--children-booked-foreground',
  },
  modify: { background: '--modify', foreground: '--modify-foreground' },
  closed: { background: '--closed', foreground: '--closed-foreground' },
}
