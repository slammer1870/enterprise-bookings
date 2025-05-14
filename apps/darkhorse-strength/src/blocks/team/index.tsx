import React from 'react'
import Image from "next/image"
import type { Media } from '@/payload-types'

type TeamMember = {
  name: string
  title: string
  image: Media
  bio: string
}

type TeamProps = {
  title: string
  teamImage: Media
  teamMembers: TeamMember[]
  aboutTitle: string
  aboutContent: Array<string | { id: string; paragraph: string }>
}

export const TeamBlock: React.FC<TeamProps> = ({
  title = 'Meet the Team',
  teamImage,
  teamMembers = [],
  aboutTitle = 'About Us',
  aboutContent = [],
}) => {
  return (
    <section className="body-font text-gray-900">
      <div className="container mx-auto flex flex-col px-5 py-12">
        <h5 className="mb-8 text-3xl font-medium ">{title}</h5>
        <div className="mx-auto">
          <div className="h-80 overflow-hidden rounded-lg md:h-64">
            <Image
              src={teamImage.url || '/placeholder.svg'}
              alt="Team image"
              width={1800}
              height={1900}
              style={{
                maxWidth: "100%",
                height: "auto",
                objectFit: "cover",
                objectPosition: "bottom"
              }} />
          </div>
          <div className="mt-10 flex flex-col lg:flex-row">
            {teamMembers.map((member: TeamMember, index: number) => (
              <div key={index} className="mb-8 text-center lg:w-1/4 lg:py-8 lg:pr-8">
                <div className="inline-flex h-32 w-32 items-center justify-center rounded-full bg-gray-200 text-gray-400">
                  <Image
                    src={member.image.url || '/placeholder.svg'}
                    alt={member.name}
                    width={500}
                    height={500}
                    className="z-10 rounded-full"
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      objectFit: "cover",
                      objectPosition: "center"
                    }} />
                </div>
                <div className="flex flex-col items-center justify-center">
                  <h2 className="title-font mt-4 text-lg font-medium text-gray-900">
                    {member.name}
                  </h2>
                  <div className="mt-2 mb-4 h-1 w-48 bg-gray-300" />
                  <p className="text-left text-base">{member.bio}</p>
                </div>
              </div>
            ))}

            <div className="mt-12 flex flex-col items-start justify-center border-t border-gray-200 pt-12 lg:mt-4 lg:w-2/4 lg:border-l lg:border-t-0 lg:py-8 lg:pl-8 lg:pt-4 lg:text-left">
              <h5 className="mb-4 text-3xl font-medium">{aboutTitle}</h5>
              <div className="mb-4 text-base leading-relaxed">
                {aboutContent.map((content, index: number) => (
                  <p key={index} className="mb-2">
                    {typeof content === 'string' ? content : content.paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
