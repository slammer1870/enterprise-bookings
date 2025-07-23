import React from 'react'
import type { Media } from '@/payload-types'

type Program = {
  title: string
  description: string
}

type AdultsProgramProps = {
  heading: string
  image: Media
  programs: Program[]
}

export const AdultsProgramBlock: React.FC<AdultsProgramProps> = ({
  heading,
  image,
  programs,
}) => {
  return (
    <section className="text-gray-900" id="adults">
      <div className="py-20 lg:py-24 px-4 md:flex items-center justify-around lg:mx-40">
        <div className="lg:w-1/2">
          <h3 className="text-3xl mb-4 font-medium">{heading}</h3>
          <div className="leading-relaxed text-gray-700 hidden md:block pr-12">
            {programs?.map((program, index) => (
              <div key={index}>
                <h5 className="text-xl font-semibold mb-2">{program.title}</h5>
                <p className={`leading-relaxed ${index < programs.length - 1 ? 'mb-2 lg:mb-8' : 'lg:mb-4'}`}>
                  {program.description}
                </p>
              </div>
            ))}
          </div>
        </div>
        
        <img
          src={image?.url || '/placeholder-adults.jpg'}
          alt={image?.alt || 'adults program'}
          className="my-8 object-cover aspect-square md:w-1/2"
        />
        
        <div className="leading-relaxed text-gray-700 md:hidden pr-12">
          {programs?.map((program, index) => (
            <div key={index}>
              <h5 className="text-xl font-semibold mb-2">{program.title}</h5>
              <p className={`leading-relaxed ${index < programs.length - 1 ? 'mb-8' : ''}`}>
                {program.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
} 