import type { RequiredDataFromCollectionSlug } from 'payload'

// Used for pre-seeded content so that the homepage is not empty
export const homeStatic: RequiredDataFromCollectionSlug<'pages'> = {
  slug: 'home',
  _status: 'published',
  layout: [
    {
      blockType: 'heroSchedule',
      blockName: 'Hero Schedule',
      title: 'ATND',
      links: [
        {
          link: {
            type: 'custom',
            appearance: 'default',
            label: 'Visit the admin dashboard',
            url: '/admin',
          },
        },
      ],
    },
  ],
  meta: {
    description: 'ATND — bookings and websites for modern venues.',
    title: 'ATND',
  },
  title: 'Home',
}
