import type { TenantBookingTheme } from '@/utilities/bookingThemeTypes'

/** Distinct check-in colors per seeded sauna tenant (Tailwind tokens for @shefing/color-picker). */
export const SEEDED_TENANT_BOOKING_THEMES: Record<string, TenantBookingTheme> = {
  dundrum: {
    checkin: { backgroundColor: 'green-500', foregroundColor: 'white' },
    cancel: { backgroundColor: 'red-500', foregroundColor: 'white' },
    trialable: { backgroundColor: 'blue-500', foregroundColor: 'white' },
    waitlist: { backgroundColor: 'amber-400', foregroundColor: 'black' },
  },
  greystones: {
    checkin: { backgroundColor: 'blue-500', foregroundColor: 'white' },
    cancel: { backgroundColor: 'red-600', foregroundColor: 'white' },
    trialable: { backgroundColor: 'cyan-500', foregroundColor: 'white' },
    waitlist: { backgroundColor: 'yellow-400', foregroundColor: 'black' },
  },
  tallaght: {
    checkin: { backgroundColor: 'amber-400', foregroundColor: 'black' },
    cancel: { backgroundColor: 'rose-500', foregroundColor: 'white' },
    trialable: { backgroundColor: 'indigo-500', foregroundColor: 'white' },
    waitlist: { backgroundColor: 'orange-400', foregroundColor: 'black' },
  },
}

export function getSeededTenantBookingTheme(slug: string): TenantBookingTheme | undefined {
  return SEEDED_TENANT_BOOKING_THEMES[slug]
}
