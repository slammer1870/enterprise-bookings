import type { Block } from 'payload'

export const SubscriptionCheckout: Block = {
  slug: 'subscriptionCheckout',
  interfaceName: 'SubscriptionCheckoutBlock',
  labels: {
    singular: 'Subscription checkout',
    plural: 'Subscription checkouts',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
      defaultValue: 'Memberships',
      admin: {
        description: 'Optional title shown above the subscription cards.',
      },
    },
    {
      name: 'plans',
      type: 'array',
      label: 'Subscriptions',
      required: true,
      minRows: 1,
      labels: {
        singular: 'Subscription',
        plural: 'Subscriptions',
      },
      admin: {
        description:
          'Select membership plans to offer. Each row becomes a subscription card.',
      },
      fields: [
        {
          name: 'plan',
          type: 'relationship',
          relationTo: 'plans',
          required: true,
          label: 'Plan',
          filterOptions: {
            status: { equals: 'active' },
          },
          admin: {
            description: 'Active membership plan to offer for subscribe / upgrade.',
          },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: false,
          label: 'Card image',
          admin: {
            description: 'Optional image shown on this subscription card.',
          },
        },
        {
          name: 'description',
          type: 'textarea',
          required: false,
          label: 'Description override',
          admin: {
            description:
              'Optional. Overrides the plan footer / description text on the card.',
          },
        },
      ],
    },
  ],
}
