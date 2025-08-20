import React from 'react'
import Image from "next/image"
import type { Media } from '@/payload-types'

type Review = {
  image: Media
  content: string
  author: string
  role: string
}

type Props = {
  title: string
  reviews: Review[]
}

export const Reviews: React.FC<Props> = ({ title, reviews }) => {
  return (
    <section>
      <div className="container mx-auto px-4 pt-20">
        <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">{title}</h3>
        <div className="flex flex-wrap">
          {reviews.map((review, index) => (
            <div key={index} className="flex items-start py-4 md:w-1/2 xl:w-1/4">
              <div className="relative h-24 w-24">
                <Image
                  src={review.image.url || ''}
                  className="rounded-full"
                  alt={`Testimonial ${review.author}`}
                  fill
                  sizes="100vw"
                  style={{
                    objectFit: "cover"
                  }} />
              </div>
              <div className="w-3/4 pl-4">
                <p className="mb-2 pr-8 text-gray-900">{review.content}</p>
                <span className="text-sm font-medium text-gray-600">
                  {review.author}, {review.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
