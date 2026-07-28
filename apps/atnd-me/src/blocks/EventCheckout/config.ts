import type { Block } from 'payload'

import { createEventTimeslotPickerFields } from '@/fields/eventTimeslotPickerFields'

/**
 * Lexical-embeddable ticket / payment UI for a timeslot.
 * Prefer this inside About (and other) rich text; use the full Event page block for a dedicated layout.
 */
export const EventCheckout: Block = {
  slug: 'eventCheckout',
  interfaceName: 'EventCheckoutBlock',
  labels: {
    singular: 'Event checkout',
    plural: 'Event checkouts',
  },
  fields: createEventTimeslotPickerFields({
    timeslotDescription:
      'Upcoming active timeslots for the selected event type. Checkout quantity, fees, and Stripe payment bind to this timeslot.',
  }),
}
