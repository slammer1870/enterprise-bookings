import { Block } from 'payload'

export const CoachingTeam: Block = {
  slug: 'coaching-team',
  labels: {
    singular: 'Coaching Team',
    plural: 'Coaching Teams',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      label: 'Heading',
      defaultValue: 'Our Coaching Team',
    },
    {
      name: 'teamMembers',
      type: 'array',
      label: 'Team Members',
      minRows: 1,
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Name',
        },
        {
          name: 'role',
          type: 'text',
          required: true,
          label: 'Role/Title',
        },
        {
          name: 'bio',
          type: 'textarea',
          required: true,
          label: 'Biography',
        },
      ],
      defaultValue: [
        {
          name: 'Barry Oglesby',
          role: 'Head Coach',
          bio: 'Barry is the founder of Kyuzo and one of the original Brazilian Jiu Jitsu Black Belts in Ireland. He enjoys teaching the fundamentals of the art for any arena- sport, self defence, or just for knowledge, and sharing his extensive experience with others.',
        },
        {
          name: 'Rowan Kelly',
          role: 'Coach',
          bio: 'A 2nd degree Black Belt in Jiu Jitsu, Rowan has 2 decades experience on the mat. A Kyuzo original, he brings his enthusiasm for highly technical Jiu Jitsu to every class he teaches.',
        },
        {
          name: 'Jessica Ryan',
          role: 'Head Coach',
          bio: 'Jess is a multiple time Irish Champion and European gold medalist, and a Black belt in Brazilian Jiu Jitsu. She brings her experience from the competitive arena to her teaching on the mats at Kyuzo.',
        },
        {
          name: 'Sean King',
          role: 'Coach',
          bio: 'Sean is an experienced competitor and coach who works with all levels in the academy. Sean\'s Jiu Jitsu style is based on movement and technicality, and his enthusiasm for the art is reflected in how he coaches.',
        },
        {
          name: 'Nathan Kelly',
          role: 'Coach',
          bio: 'Nathan coaches our NoGi and Kids classes. He is a professional MMA fighter and brings his real world experience in combat sports into his coaching. He has a technical style based on pressure and high level movement, as well as a relentless enthusiasm for hard work and training.',
        },
        {
          name: 'David Akinyemi',
          role: 'Coach',
          bio: 'Dave coaches Teens and Adults at Kyuzo, and is an active Masters competitor. With his enthusiasm for Jiu Jitsu, you\'ll find him on the mat training alongside everyone as well as sharing his extensive experience in the classes he coaches.',
        },
      ],
    },
  ],
} 