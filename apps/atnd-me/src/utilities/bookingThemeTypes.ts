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

export type BookingThemeConfig = {
  checkin?: {
    backgroundColor?: string | null
    foregroundColor?: string | null
  }
  trialable?: {
    backgroundColor?: string | null
    foregroundColor?: string | null
  }
  cancel?: {
    backgroundColor?: string | null
    foregroundColor?: string | null
  }
  waitlist?: {
    backgroundColor?: string | null
    foregroundColor?: string | null
  }
  childrenBooked?: {
    backgroundColor?: string | null
    foregroundColor?: string | null
  }
  modify?: {
    backgroundColor?: string | null
    foregroundColor?: string | null
  }
  closed?: {
    backgroundColor?: string | null
    foregroundColor?: string | null
  }
}

/** @deprecated Use BookingThemeConfig — kept for existing imports during transition. */
export type TenantBookingTheme = BookingThemeConfig
export type BookingThemeButtonColors = NonNullable<BookingThemeConfig['checkin']>

/** Maps bookingTheme field keys to CSS custom property names. */
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
