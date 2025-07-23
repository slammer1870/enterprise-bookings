import { Block } from 'payload'

export const KidsProgram: Block = {
  slug: 'kids-program',
  labels: {
    singular: 'Kids Program',
    plural: 'Kids Programs',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      label: 'Heading',
      defaultValue: "Kid's Program",
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      label: 'Description',
      defaultValue: 'Our Kid\'s classes are designed to get your child more active while having fun through learning Martial Arts',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Kids Program Image',
    },
    {
      name: 'ageGroups',
      type: 'array',
      label: 'Age Groups',
      minRows: 1,
      maxRows: 4,
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Age Group Title',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          label: 'Age Group Description',
        },
      ],
      defaultValue: [
        {
          title: 'Mighty Mites for 4 to 7 year olds',
          description: 'This class uses fun games and drills to start your little one on the martial arts path. We teach the basic positions of Jiu Jitsu, as well as using games that improve balance, coordination, confidence, and flexibility.',
        },
        {
          title: 'Pee Wees for 7 to 9 year olds',
          description: 'The Pee Wees learn Jiu Jitsu positions and techniques in a fun, playful manner. Our focus is on enjoyment and developing their physical attributes such as balance, coordination, strength, and agility. They make new friends while learning self defence skills.',
        },
        {
          title: 'Juniors for 10 to 12 year olds',
          description: 'This age group focuses on the fundamental techniques of Jiu Jitsu, as well as playing martial arts related games to develop their physical qualities. We focus on teaching skills for self defence as well as drills to improve athletic ability, all the while making sure training is fun and enjoyable.',
        },
        {
          title: 'Teens for 13 to 16 year olds',
          description: 'Our Teens programme is for young people who want to learn self defence, get fit, and make new friends in a friendly and welcoming team environment. We take new teen members all year round and there\'s no level of fitness or experience required. Whether you want to compete in the sport of Jiu Jitsu or just learn one of the most effective martial arts, this class is for you.',
        },
      ],
    },
  ],
} 