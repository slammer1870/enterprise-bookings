import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Media } from '@/payload-types'

type CroiLanSaunaPageArgs = {
  heroImage: Media
  logo?: Media | null
  aboutImage: Media
}

// Helper function to create a simple richText structure
const createSimpleRichText = (text: string) => ({
  root: {
    type: 'root' as const,
    children: [
      {
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
      },
    ],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

// Helper function to create rich text with multiple paragraphs
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

export const croiLanSaunaPage: (args: CroiLanSaunaPageArgs) => RequiredDataFromCollectionSlug<'pages'> = ({
  heroImage,
  logo,
  aboutImage,
}) => {
  return {
    slug: 'home',
    _status: 'published',
    hero: {
      type: 'lowImpact' as const,
      richText: {
        root: {
          type: 'root' as const,
          children: [],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          version: 1,
        },
      },
    },
    layout: [
      // Hero Schedule block
      {
        blockName: 'Hero Schedule',
        blockType: 'heroSchedule',
        backgroundImage: heroImage.id,
        logo: logo?.id || undefined,
        title: 'CROÍ LÁN SAUNA',
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
      // Location block
      {
        blockName: 'Find Your Sanctuary',
        blockType: 'location',
        title: 'Find Your Sanctuary',
        description: '30 minutes outside Dublin. Free parking available.',
        address: 'The Bog Meadow, Enniskerry Village, Co. Wicklow, Ireland',
        email: undefined,
        phone: undefined,
        mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2388.1234567890!2d-6.123456!3d53.123456!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTPCsDA3JzI0LjUiTiA2wrAwNycwNC40Ilc!5e0!3m2!1sen!2sie!4v1234567890123!5m2!1sen!2sie',
      },
      // About block
      {
        blockName: 'Filling the Heart, Restoring the Soul',
        blockType: 'about',
        title: 'Filling the Heart, Restoring the Soul',
        image: aboutImage.id,
        content: createRichTextWithParagraphs([
          'At Croí Lán, we believe a full heart comes from connection.',
          "Nestled at the foot of the Wicklow mountains, Croí Lán Sauna is more than a place to warm your bones. It's a space to reconnect. With yourself. With others. With nature.",
          'We offer more than just hot and cold, we offer a return to something deeply human. A quiet conversation after a cold plunge. The comfort of shared silence in the sauna. A moment of stillness in a noisy world.',
          "This is wellness without the frills. Just heat, cold, community, and space to breathe. We're here for people of all ages and stages, creating a space where it's safe to slow down, to connect, to feel full-hearted again.",
          "It's simple. But it works. And most people don't get enough of it.",
        ]),
      },
      // Health Benefits section as Content block
      {
        blockName: 'Health Benefits of Sauna',
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: {
              root: {
                type: 'root' as const,
                children: [
                  {
                    type: 'heading' as const,
                    children: [
                      {
                        type: 'text' as const,
                        detail: 0,
                        format: 0,
                        mode: 'normal' as const,
                        style: '',
                        text: 'Health Benefits of Sauna',
                        version: 1,
                      },
                    ],
                    direction: 'ltr' as const,
                    format: '' as const,
                    indent: 0,
                    tag: 'h2',
                    version: 1,
                  },
                  {
                    type: 'heading' as const,
                    children: [
                      {
                        type: 'text' as const,
                        detail: 0,
                        format: 0,
                        mode: 'normal' as const,
                        style: '',
                        text: 'Reduced inflammation & muscle soreness',
                        version: 1,
                      },
                    ],
                    direction: 'ltr' as const,
                    format: '' as const,
                    indent: 0,
                    tag: 'h3',
                    version: 1,
                  },
                  {
                    type: 'paragraph' as const,
                    children: [
                      {
                        type: 'text' as const,
                        detail: 0,
                        format: 0,
                        mode: 'normal' as const,
                        style: '',
                        text: 'Reep positive effects on recovery after exercise.',
                        version: 1,
                      },
                    ],
                    direction: 'ltr' as const,
                    format: '' as const,
                    indent: 0,
                    textFormat: 0,
                    version: 1,
                  },
                  {
                    type: 'heading' as const,
                    children: [
                      {
                        type: 'text' as const,
                        detail: 0,
                        format: 0,
                        mode: 'normal' as const,
                        style: '',
                        text: 'Improve cognitive function',
                        version: 1,
                      },
                    ],
                    direction: 'ltr' as const,
                    format: '' as const,
                    indent: 0,
                    tag: 'h3',
                    version: 1,
                  },
                  {
                    type: 'paragraph' as const,
                    children: [
                      {
                        type: 'text' as const,
                        detail: 0,
                        format: 0,
                        mode: 'normal' as const,
                        style: '',
                        text: 'Studies show that cold water exposure may improve attention, processing speed, memory and cognitive function.',
                        version: 1,
                      },
                    ],
                    direction: 'ltr' as const,
                    format: '' as const,
                    indent: 0,
                    textFormat: 0,
                    version: 1,
                  },
                  {
                    type: 'heading' as const,
                    children: [
                      {
                        type: 'text' as const,
                        detail: 0,
                        format: 0,
                        mode: 'normal' as const,
                        style: '',
                        text: 'Better quality sleep',
                        version: 1,
                      },
                    ],
                    direction: 'ltr' as const,
                    format: '' as const,
                    indent: 0,
                    tag: 'h3',
                    version: 1,
                  },
                  {
                    type: 'paragraph' as const,
                    children: [
                      {
                        type: 'text' as const,
                        detail: 0,
                        format: 0,
                        mode: 'normal' as const,
                        style: '',
                        text: 'Inducing relaxation and releasing melatonin can aid your body during sleep that night.',
                        version: 1,
                      },
                    ],
                    direction: 'ltr' as const,
                    format: '' as const,
                    indent: 0,
                    textFormat: 0,
                    version: 1,
                  },
                ],
                direction: 'ltr' as const,
                format: '' as const,
                indent: 0,
                version: 1,
              },
            },
            enableLink: false,
          },
        ],
      },
    ],
    meta: {
      description: 'Here, warmth meets the soul. In the heart of Wicklow\'s countryside, find restoration, renewal and leave with your heart full.',
      image: heroImage.id,
      title: 'Croí Lán Sauna - Where warmth meets the soul',
    },
    title: 'Home',
  }
}
