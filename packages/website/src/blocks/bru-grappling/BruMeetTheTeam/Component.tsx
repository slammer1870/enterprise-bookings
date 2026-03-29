'use client'

import React from 'react'
import Image from 'next/image'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText } from '@payloadcms/richtext-lexical/react'

type ImageLike =
  | {
      url?: string
      alt?: string
    }
  | number
  | string

function getImageUrl(image: ImageLike | undefined | null): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (typeof image === 'object' && image?.url) return image.url
  return null
}

type TeamMember = {
  image: ImageLike
  name: string
  role: string
  bio: SerializedEditorState
}

export const BruMeetTheTeamBlock: React.FC<{
  teamMembers: TeamMember[]
}> = ({ teamMembers }) => {
  return (
    <section>
      <div className="container mx-auto px-4 py-20">
        <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">
          Meet the team
        </h3>
        <div className="flex flex-wrap justify-center">
          {teamMembers.map((member, index) => {
            const imageUrl = getImageUrl(member.image)
            return (
              <div
                key={member.name}
                className={`mb-4 w-full py-4 ${index % 2 === 0 ? 'pr-4' : ''} md:w-1/2`}
              >
                <div className="relative mx-auto mb-4 h-36 w-36 md:mb-8">
                  {imageUrl && (
                    <Image
                      src={imageUrl}
                      className="rounded-full"
                      alt={member.name}
                      fill
                      sizes="144px"
                      style={{
                        objectFit: 'cover',
                      }}
                    />
                  )}
                </div>
                <h5 className="mb-4 text-xl font-medium">
                  {member.name} - <span className="font-normal text-gray-800">{member.role}</span>
                </h5>
                <RichText data={member.bio} className="prose" />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

