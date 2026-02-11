import type { RequiredDataFromCollectionSlug } from 'payload'

// Used for pre-seeded content so that the homepage is not empty
export const homeStatic: RequiredDataFromCollectionSlug<'pages'> = {
  slug: 'home',
  _status: 'published',
  layout: [
    {
      blockType: 'heroSchedule',
      blockName: 'Hero Schedule',
      title: 'Payload Website Template',
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
    description: 'An open-source website built with Payload and Next.js.',
    title: 'Payload Website Template',
  },
  title: 'Home',
}
