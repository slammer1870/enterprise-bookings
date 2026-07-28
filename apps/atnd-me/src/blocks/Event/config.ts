import type { Block } from 'payload'

import { createEventTimeslotPickerFields } from '@/fields/eventTimeslotPickerFields'
import { simpleLexical } from '@/fields/simpleLexical'

export const Event: Block = {
  slug: 'event',
  interfaceName: 'EventBlock',
  labels: {
    singular: 'Event',
    plural: 'Events',
  },
  fields: [
    ...createEventTimeslotPickerFields({
      timeslotDescription:
        'Upcoming active timeslots for the selected event type. Date, time, host, capacity, and ticket price come from the timeslot / event type.',
    }),
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
      label: 'Cover image',
      admin: {
        description: 'Hero cover for the event page. Falls back to a solid background when empty.',
      },
    },
    {
      name: 'about',
      type: 'richText',
      required: false,
      label: 'About',
      editor: simpleLexical,
      admin: {
        description:
          'Event description shown in the About section. Falls back to the event type description when empty.',
      },
    },
    {
      name: 'mapUrl',
      type: 'text',
      required: false,
      label: 'Google Maps URL',
      admin: {
        description:
          'Optional. Paste a Google Maps link (including maps.app.goo.gl). Falls back to the branch address when empty.',
      },
    },
  ],
}
