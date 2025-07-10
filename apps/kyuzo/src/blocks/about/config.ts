import { Block } from 'payload'

export const About: Block = {
  slug: 'about',
  labels: {
    singular: 'About',
    plural: 'About',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      label: 'Heading',
      defaultValue: 'About Us',
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      label: 'Content',
      defaultValue: {
        children: [
          {
            type: 'paragraph',
            children: [
              {
                text: "Kyuzo is one of Dublin's oldest Brazilian Jiu Jitsu academies, and our coaches have two decades experience teaching the martial arts.",
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                text: 'We are committed to sharing the art of Brazilian Jiu Jitsu with everyone who wants to learn it. Whether your goal is Self Defence, Fitness, or the Sport of Jiu Jitsu, we have a class for you.',
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                text: 'We are focused on getting the absolute beginner into training, and have a friendly, no nonsense approach to training. Get in touch with us now to find out how we can help you!',
              },
            ],
          },
        ],
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'About Image',
    },
  ],
}
