import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Media } from '@/payload-types'

type HomeArgs = {
  heroImage: Media
  metaImage: Media
  logo?: Media | null
}

// Helper function to create a simple richText structure
const createSimpleRichText = (text: string) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: text,
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})

export const home: (args: HomeArgs) => RequiredDataFromCollectionSlug<'pages'> = ({
  heroImage,
  metaImage,
  logo,
}) => {
  return {
    slug: 'home',
    _status: 'published',
    hero: {
      type: 'lowImpact',
      richText: {
        root: {
          type: 'root',
          children: [],
          direction: 'ltr',
          format: '',
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
        title: 'Welcome to Our Studio',
        links: [
          {
            link: {
              type: 'custom',
              appearance: 'default',
              label: 'Book a Class',
              url: '/bookings',
            },
          },
        ],
      },
      // Three Column Layout with About, Location, and FAQs
      {
        blockName: 'About, Location & FAQs',
        blockType: 'threeColumnLayout',
        blocks: [
          // About block
          {
            blockType: 'about',
            title: 'About Us',
            image: metaImage.id,
            content: createSimpleRichText(
              'We are a welcoming community dedicated to health and wellness. Our experienced instructors provide personalized guidance to help you achieve your fitness goals. Join us for classes that combine strength, flexibility, and mindfulness.'
            ),
          },
          // Location block
          {
            blockType: 'location',
            title: 'Find Us',
            description: 'Visit us at our convenient location in the heart of the city.',
            address: '123 Main Street, City, State 12345',
            email: 'info@example.com',
            phone: '+1 (555) 123-4567',
            mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.184132239089!2d-73.98811768459398!3d40.75889597932681!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c25855c6480299%3A0x55194ec5a1ae072e!2sTimes%20Square!5e0!3m2!1sen!2sus!4v1234567890123!5m2!1sen!2sus',
          },
          // FAQs block
          {
            blockType: 'faqs',
            title: 'FAQs',
            faqs: [
              {
                question: 'Do I need to book in advance?',
                answer: 'Yes, we recommend booking your classes in advance to secure your spot. You can book up to 2 weeks in advance.',
              },
              {
                question: 'What should I bring to class?',
                answer: 'Please bring a water bottle, towel, and comfortable workout clothes. Mats and equipment are provided.',
              },
              {
                question: 'Can I cancel my booking?',
                answer: 'Yes, you can cancel your booking up to 24 hours before the class starts. Cancellations within 24 hours may be subject to our cancellation policy.',
              },
              {
                question: 'Do you offer trial classes?',
                answer: 'Yes! New members can try their first class for free. Contact us to schedule your trial class.',
              },
            ],
          },
        ],
      },
    ],
    meta: {
      description: 'An open-source website built with Payload and Next.js.',
      image: heroImage.id,
      title: 'Payload Website Template',
    },
    title: 'Home',
  }
}
