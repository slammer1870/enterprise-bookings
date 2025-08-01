import React from 'react'
import Image from 'next/image'
import type { Media } from '@/payload-types'

type TeamMember = {
  image: Media
  name: string
  role: string
  bio: string
}

type Props = {
  teamMembers: TeamMember[]
}

export const MeetTheTeamBlock: React.FC<Props> = ({ teamMembers }) => {
  return (
    <section>
      <div className="container mx-auto px-4 py-20">
        <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">
          Meet the team
        </h3>
        <div className="flex flex-wrap">
          {teamMembers.map((member, index) => (
            <div
              key={member.name}
              className={`mb-4 w-full py-4 ${index % 2 === 0 ? 'pr-4' : ''} md:w-1/2`}
            >
              <div className="relative mx-auto mb-4 h-36 w-36 md:mb-8">
                <Image
                  src={member.image.url || ''}
                  layout="fill"
                  objectFit="cover"
                  className="rounded-full"
                  alt={member.name}
                />
              </div>
              <h5 className="mb-4 text-xl font-medium">
                {member.name} - <span className="font-normal text-gray-800">{member.role}</span>
              </h5>
              <p className="text-lg text-gray-700">{member.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
