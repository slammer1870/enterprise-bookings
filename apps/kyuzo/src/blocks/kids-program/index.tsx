import React from 'react'
import type { Media } from '@/payload-types'

type AgeGroup = {
  title: string
  description: string
}

type KidsProgramProps = {
  heading: string
  description: string
  image: Media
  ageGroups: AgeGroup[]
}

export const KidsProgramBlock: React.FC<KidsProgramProps> = ({
  heading,
  description,
  image,
  ageGroups,
}) => {
  return (
    <section className="text-gray-900" id="kids">
      <div className="px-4 py-20 lg:mx-40 lg:flex items-center justify-around">
        <div className="lg:hidden">
          <h3 className="text-3xl mb-4 font-medium">{heading}</h3>
          <p className="mb-4 leading-relaxed text-gray-700">{description}</p>
        </div>
        
        <img
          src={image?.url || '/placeholder-children.jpg'}
          alt={image?.alt || 'children'}
          className="my-8 object-cover aspect-square lg:w-1/2 xl:w-1/3 lg:pr-8 w-full"
        />
        
        <div className="lg:w-1/2">
          <div className="hidden lg:block xl:text-xl">
            <h3 className="text-3xl mb-4 font-medium">{heading}</h3>
            <p className="mb-4 leading-relaxed text-gray-700">{description}</p>
          </div>
          
          <div className="md:grid gap-4 grid-cols-1 grid-rows-4 xl:grid-cols-2 xl:grid-rows-2 mx-auto w-full xl:col-span-1">
            {ageGroups?.map((ageGroup, index) => (
              <div
                key={index}
                className="mb-4 pr-4 border-r-2 border-gray-900 md:col-span-1 flex flex-col items-start justify-center"
              >
                <h5 className="font-medium mb-2">{ageGroup.title}</h5>
                <p className="text-gray-700 leading-relaxed">{ageGroup.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
} 