import React from 'react'
import Image from 'next/image'
import type { Media } from '@/payload-types'
import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText } from '@payloadcms/richtext-lexical/react'

type Testimonial = {
  image: Media
  name: string
  role: string
  testimonial: SerializedEditorState
}

type Props = {
  title: string
  testimonials: Testimonial[]
}

export const TestimonialsBlock: React.FC<Props> = ({ title, testimonials }) => {
  return (
    <section>
      <div className="container mx-auto px-4 pt-20">
        <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">
          {title}
        </h3>
        <div className="flex flex-wrap">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="flex items-start py-4 md:w-1/2 xl:w-1/4">
              <div className="relative h-24 w-24">
                <Image
                  src={testimonial.image.url || ''}
                  fill
                  sizes="96px"
                  style={{ objectFit: 'cover' }}
                  className="rounded-full"
                  alt={`Testimonial ${testimonial.name}`}
                />
              </div>
              <div className="w-3/4 pl-4">
                <div className="mb-2 pr-8 text-gray-900">
                  <RichText data={testimonial.testimonial} className="prose prose-sm" />
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {testimonial.name}, {testimonial.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
