import type { Block } from 'payload'

export const GiftVoucherCheckout: Block = {
  slug: 'giftVoucherCheckout',
  interfaceName: 'GiftVoucherCheckoutBlock',
  labels: {
    singular: 'Gift voucher checkout',
    plural: 'Gift voucher checkouts',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
      defaultValue: 'Buy a gift voucher',
      admin: {
        description: 'Optional title shown above the checkout form.',
      },
    },
    {
      name: 'minAmount',
      type: 'number',
      label: 'Minimum amount (€)',
      defaultValue: 5,
      min: 5,
      admin: {
        step: 0.01,
        description: 'Minimum gift voucher amount in euros (must be at least €5).',
      },
    },
    {
      name: 'maxAmount',
      type: 'number',
      label: 'Maximum amount (€)',
      admin: {
        step: 0.01,
        description: 'Optional maximum. Leave empty for no max (API hard ceiling is €10,000).',
      },
    },
  ],
}
