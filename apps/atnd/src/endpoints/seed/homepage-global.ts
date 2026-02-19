import type { Form, Homepage } from '@/payload-types'

/** Builds Lexical richText root shape for seed data */
function rootRichText(
  children: { type: string; version: number; [k: string]: unknown }[],
): NonNullable<Homepage['hero']>['richText'] {
  return {
    root: {
      type: 'root',
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

const paragraph = (text: string) => ({
  type: 'paragraph',
  children: [
    {
      type: 'text',
      detail: 0,
      format: 0,
      mode: 'normal' as const,
      style: '',
      text,
      version: 1,
    },
  ],
  direction: 'ltr' as const,
  format: '',
  indent: 0,
  textFormat: 0,
  version: 1,
})

const heading = (text: string, tag: 'h1' | 'h2' | 'h3' = 'h2') => ({
  type: 'heading',
  children: [
    {
      type: 'text',
      detail: 0,
      format: 0,
      mode: 'normal' as const,
      style: '',
      text,
      version: 1,
    },
  ],
  direction: 'ltr' as const,
  format: '',
  indent: 0,
  tag,
  version: 1,
})

type Args = {
  contactForm: Form
}

/**
 * Seed data for the Homepage global – matches atnd.ie structure:
 * Hero, SaaS Hero block, Case Studies, Contact form.
 */
export const homepageGlobalData = ({ contactForm }: Args): Partial<Homepage> => ({
  hero: {
    type: 'lowImpact',
    richText: rootRichText([
      heading('Booking Software that actually works', 'h1'),
      paragraph(
        'ATND is the modern booking platform that helps businesses manage appointments, reduce no-shows, and delight customers—all in one beautiful interface.',
      ),
    ]),
  },
  layout: [
    {
      blockType: 'marketingHero',
      blockName: 'Hero',
      headline: 'Booking Software that actually works',
      subheadline: rootRichText([
        paragraph(
          'ATND is the modern booking platform that helps businesses manage appointments, reduce no-shows, and delight customers—all in one beautiful interface.',
        ),
      ]),
      alignment: 'center',
      backgroundColor: 'default',
    },
    {
      blockType: 'caseStudies',
      blockName: 'Case Studies',
      heading: 'Case Studies',
      description: rootRichText([
        paragraph(
          'We work with a variety of different industries to produce bespoke booking software',
        ),
      ]),
      caseStudies: [
        {
          companyName: 'Brú Grappling Studio',
          quote:
            'Our business has been transformed by creating a bespoke system built around our business model rather than having to bend to fit some prebuilt solution, ATND automates the boring stuff',
          author: {
            name: 'Emily Manning',
            title: 'Operations Manager',
          },
          results: [
            { metric: 'Optimised Conversion Funnel', description: 'New customers are self onboard through the online booking system' },
            { metric: 'Traceable Marketing Spend', description: 'Specialised analytics were implemented to allow for a fine grained approach to analytics without having to sell their data to big tech' },
          ],
          link: {
            type: 'custom',
            url: 'https://brugrappling.ie/',
            label: 'See the full website',
            newTab: true,
          },
        },
        {
          companyName: 'Dark Horse Strength and Performance',
          quote:
            'We had a list of custom features we needed that weren\'t available through standard booking platforms and ATND were able to build these out',
          author: {
            name: 'Conor McCabe',
            title: 'Owner',
          },
          results: [
            { metric: 'Churn Reduction', description: 'Custom strategies were implement to follow user behaviour in implementing churn reduction' },
            { metric: 'Unique Customer Journey', description: 'UX and Pricing variations were introduced to provide a unique customer journey for members.' },
          ],
          link: {
            type: 'custom',
            url: 'https://darkhorsestrength.ie/',
            label: 'See the full website',
            newTab: true,
          },
        },
        {
          companyName: 'Kyuzo',
          quote:
            'The previous system we used increased their fees, ATND were able to provide us with bespoke software at a more competitive price',
          author: {
            name: 'Barry Oglesby',
            title: 'Owner',
          },
          results: [
            { metric: 'Memberships for Adults and Children', description: 'Custom functionality to manage subscriptions that encompassed regular members and parents of children who are members' },
            { metric: 'On-Site Additions', description: 'Bespoke on-site solutions for check in and membership management were a key feature needed.' },
          ],
          link: {
            type: 'custom',
            url: 'https://kyuzo.ie/',
            label: 'See the full website',
            newTab: true,
          },
        },
      ],
      layout: 'carousel',
      backgroundColor: 'default',
    },
    {
      blockType: 'formBlock',
      blockName: 'Contact',
      form: contactForm.id,
      enableIntro: true,
      introContent: rootRichText([
        heading('Looking for more information?', 'h2'),
        paragraph('Fill in the form below and one of our team will be in touch.'),
      ]),
    },
  ],
  meta: {
    title: 'ATND | Modern Bespoke Booking Software',
    description:
      'ATND is the modern booking platform that helps businesses manage appointments, reduce no-shows, and delight customers—all in one beautiful interface.',
  },
})
