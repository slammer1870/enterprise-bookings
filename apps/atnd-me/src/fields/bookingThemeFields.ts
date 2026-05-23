import type { Field } from 'payload'

import {
  BOOKING_THEME_STATE_KEYS,
  type BookingThemeStateKey,
} from '@/utilities/bookingThemeTypes'

const BUTTON_STATE_LABELS: Record<BookingThemeStateKey, string> = {
  checkin: 'Check-in / Book',
  trialable: 'Trial class',
  cancel: 'Cancel',
  waitlist: 'Waitlist',
  childrenBooked: 'Manage children',
  modify: 'Modify',
  closed: 'Closed',
}

function bookingThemeColorField(name: 'backgroundColor' | 'foregroundColor', label: string): Field {
  return {
    name,
    type: 'text',
    label,
    admin: {
      components: {
        Field: '@/components/admin/booking-theme/BookingThemeColorField#BookingThemeColorField',
      },
    },
  }
}

function buttonStateGroup(name: BookingThemeStateKey, label: string): Field {
  return {
    name,
    type: 'group',
    label,
    fields: [
      bookingThemeColorField('backgroundColor', 'Background color'),
      bookingThemeColorField('foregroundColor', 'Text color'),
    ],
  }
}

export const bookingThemeField: Field = {
  name: 'bookingTheme',
  type: 'group',
  label: 'Booking button colors',
  admin: {
    description:
      'Customize schedule check-in and booking button colors. Leave fields empty to use platform defaults.',
  },
  fields: [
    {
      name: 'preview',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/booking-theme/BookingThemePreviewField#BookingThemePreviewField',
        },
      },
    },
    ...BOOKING_THEME_STATE_KEYS.map((key) => buttonStateGroup(key, BUTTON_STATE_LABELS[key])),
  ],
}
