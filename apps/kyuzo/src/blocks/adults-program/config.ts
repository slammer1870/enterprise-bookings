import { Block } from 'payload'

export const AdultsProgram: Block = {
  slug: 'adults-program',
  labels: {
    singular: 'Adults Program',
    plural: 'Adults Programs',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      label: 'Heading',
      defaultValue: 'Adults Program',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Adults Program Image',
    },
    {
      name: 'programs',
      type: 'array',
      label: 'Program Sections',
      minRows: 1,
      maxRows: 4,
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Program Title',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          label: 'Program Description',
        },
      ],
      defaultValue: [
        {
          title: 'JIU JITSU INTRODUCTION',
          description: 'This class is for total beginners to Jiu Jitsu. If you\'re curious about Jiu Jitsu and want to know more about how Kyuzo trains and teaches, this is the session for you. In this class, you\'ll learn basic Jiu Jitsu techniques, safety, and self defence moves from our welcoming and knowledgeable coaches.No gear or fitness required!',
        },
        {
          title: 'Fundamentals - The Building Blocks of Jiu Jitsu',
          description: 'The Fundamentals classes will be for anyone from Beginner upwards who wants to learn the techniques of Brazilian Jiu Jitsu. This class is suitable for White belts who want to learn the basics, and for colour belts who want to brush up on their fundamental techniques.',
        },
        {
          title: 'Advanced - Train to Improve',
          description: 'This class is for Blue belt and up, and teaches the Kyuzo Advanced curriculum. This session is designed around the sport of Jiu Jitsu, with the very best battle-tested techniques from the competition mats.',
        },
      ],
    },
  ],
} 