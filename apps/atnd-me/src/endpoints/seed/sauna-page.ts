import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Media } from '@/payload-types'

type SaunaPageArgs = {
  tenantName: string
  heroImage: Media
  logo?: Media | null
  aboutImage: Media
}

const createRichTextWithParagraphs = (paragraphs: string[]) => ({
  root: {
    type: 'root' as const,
    children: paragraphs.map((text) => ({
      type: 'paragraph' as const,
      children: [
        {
          type: 'text' as const,
          detail: 0,
          format: 0,
          mode: 'normal' as const,
          style: '',
          text: text,
          version: 1,
        },
      ],
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      textFormat: 0,
      version: 1,
    })),
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

export const saunaPage: (args: SaunaPageArgs) => RequiredDataFromCollectionSlug<'pages'> = ({
  tenantName,
  heroImage,
  logo,
  aboutImage,
}) => ({
  slug: 'home',
  _status: 'published',
  layout: [
    {
      blockName: 'Hero Schedule',
      blockType: 'heroSchedule',
      backgroundImage: heroImage.id,
      logo: logo?.id || undefined,
      title: tenantName.toUpperCase(),
      links: [
        {
          link: {
            type: 'custom',
            appearance: 'default',
            label: 'Book Your Session',
            url: '/bookings',
          },
        },
      ],
    },
    {
      blockName: 'About, Location & FAQs',
      blockType: 'threeColumnLayout',
      blocks: [
        {
          blockType: 'about',
          title: 'Sauna & Wellness',
          image: aboutImage.id,
          content: createRichTextWithParagraphs([
            `${tenantName} offers a warm escape from the everyday.`,
            'Experience traditional sauna with modern amenities. Relax, recover, and reconnect in our carefully maintained space.',
            'We welcome people of all ages. Book a session and discover the benefits of heat therapy.',
          ]),
        },
        {
          blockType: 'location',
          title: 'Find Us',
          description: 'Visit us for your sauna session.',
          address: `${tenantName}, Ireland`,
          email: undefined,
          phone: undefined,
          mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2388.1234567890!2d-6.123456!3d53.123456!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTPCsDA3JzI0LjUiTiA2wrAwNycwNC40Ilc!5e0!3m2!1sen!2sie!4v1234567890123!5m2!1sen!2sie',
        },
        {
          blockType: 'faqs',
          title: 'FAQs',
          faqs: [
            {
              question: 'How do I book a session?',
              answer: 'Book online through our booking system. Select your preferred date and time, and complete the booking.',
            },
            {
              question: 'What should I bring?',
              answer: 'Bring a towel and water bottle. Please arrive 5 minutes before your session.',
            },
            {
              question: 'Is there a cancellation policy?',
              answer: 'You can cancel up to 24 hours before your session for a full refund.',
            },
          ],
        },
      ],
    },
  ],
  meta: {
    description: `${tenantName} — Sauna sessions and wellness. Book your session online.`,
    image: heroImage.id,
    title: `${tenantName} — Sauna`,
  },
  title: 'Home',
})
