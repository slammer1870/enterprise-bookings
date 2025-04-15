import { Block } from 'payload'

export const Timetable: Block = {
  slug: 'timetable',
  labels: {
    singular: 'Timetable',
    plural: 'Timetables',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Section Title',
      defaultValue: 'Timetable',
    },
    {
      name: 'description',
      type: 'text',
      required: true,
      label: 'Description',
      defaultValue: 'Check out our class times.',
    },
    {
      name: 'timeSlots',
      type: 'array',
      label: 'Time Slots',
      minRows: 1,
      fields: [
        {
          name: 'time',
          type: 'text',
          required: true,
          label: 'Time',
        },
        {
          name: 'monday',
          type: 'text',
          label: 'Monday',
        },
        {
          name: 'tuesday',
          type: 'text',
          label: 'Tuesday',
        },
        {
          name: 'wednesday',
          type: 'text',
          label: 'Wednesday',
        },
        {
          name: 'thursday',
          type: 'text',
          label: 'Thursday',
        },
        {
          name: 'friday',
          type: 'text',
          label: 'Friday',
        },
        {
          name: 'saturday',
          type: 'text',
          label: 'Saturday',
        },
        {
          name: 'sunday',
          type: 'text',
          label: 'Sunday',
        },
      ],
    },
    {
      name: 'legend',
      type: 'text',
      required: true,
      label: 'Legend Text',
    },
  ],
}
