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
      blockName: 'Croí Lán – Hero with Location',
      blockType: 'clHeroLoc',
      backgroundImage: heroImage.id,
      logo: logo?.id || undefined,
      title: tenantName.toUpperCase(),
      titleLine2: 'SAUNA',
      titleLine1Accent: true,
      locationText: `${tenantName} — demo sauna tenant`,
      locationSubtext: 'Book online · inspired by croilan.com layout',
      showLocationIcon: true,
      introTagline:
        "Here, warmth meets the soul. In the heart of Wicklow's countryside, find restoration, renewal and leave with your heart full.",
      links: [
        {
          link: {
            type: 'custom',
            appearance: 'default',
            label: 'Book Your Session',
            url: '/bookings',
          },
        },
        {
          link: {
            type: 'custom',
            appearance: 'outline',
            label: 'Follow Us',
            url: 'https://www.instagram.com/croilansauna/',
            newTab: true,
          },
        },
      ],
      socialFollowLabel: 'Follow Us',
      socialFollowUrl: 'https://www.instagram.com/croilansauna/',
    },
    {
      blockName: 'Find Your Sanctuary',
      blockType: 'clFindSanctuary',
      heading: 'Find Your Sanctuary',
      address: `${tenantName} — see booking confirmation for studio address`,
      note: 'Free parking available (demo copy)',
    },
    {
      blockName: 'Mission',
      blockType: 'clMission',
      heading: 'Filling the Heart, Restoring the Soul',
      lede: 'At Croí Lán, we believe a full heart comes from connection.',
      body: createRichTextWithParagraphs([
        "Nestled at the foot of the Wicklow mountains, Croí Lán Sauna is more than a place to warm your bones. It's a space to reconnect. With yourself. With others. With nature.",
        'We offer more than just hot and cold, we offer a return to something deeply human. A quiet conversation after a cold plunge. The comfort of shared silence in the sauna. A moment of stillness in a noisy world.',
        "This is wellness without the frills. Just heat, cold, community, and space to breathe. We're here for people of all ages and stages, creating a space where it's safe to slow down, to connect, to feel full-hearted again.",
        "It's simple. But it works. And most people don't get enough of it.",
      ]),
    },
    {
      blockName: 'Pillars',
      blockType: 'clPillars',
      items: [{ label: 'Release.' }, { label: 'Relax.' }, { label: 'Recover.' }],
    },
    {
      blockName: 'Sauna benefits',
      blockType: 'clSaunaBenefits',
      sectionTitle: 'Health Benefits of Sauna',
      items: [
        {
          title: 'Reduced inflammation & muscle soreness',
          description: 'Reap positive effects on recovery after exercise.',
        },
        {
          title: 'Improve cognitive function',
          description:
            'Studies show that cold water exposure may improve attention, processing speed, memory and cognitive function.',
        },
        {
          title: 'Better quality sleep',
          description:
            'Inducing relaxation and releasing melatonin can aid your body during sleep that night.',
        },
        {
          title: 'Restore balance to the nervous system',
          description:
            'Research shows cold water exposure causes a shift in your parasympathetic nervous system, controlled by your vagus nerve.',
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
          mapEmbedUrl:
            'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2388.1234567890!2d-6.123456!3d53.123456!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTPCsDA3JzI0LjUiTiA2wrAwNycwNC40Ilc!5e0!3m2!1sen!2sie!4v1234567890123!5m2!1sen!2sie',
        },
        {
          blockType: 'faqs',
          title: 'FAQs',
          faqs: [
            {
              question: 'How do I book a session?',
              answer:
                'Book online through our booking system. Select your preferred date and time, and complete the booking.',
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
