import type { Block } from 'payload'
import { bookingThemeField } from '@/fields/bookingThemeFields'

export const DhLiveSchedule: Block = {
  slug: 'dhLiveSchedule',
  labels: {
    singular: 'Live class schedule (Dark Horse)',
    plural: 'Live class schedules',
  },
  fields: [bookingThemeField],
}
