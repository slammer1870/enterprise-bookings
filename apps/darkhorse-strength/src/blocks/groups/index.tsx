import React from 'react'
import Image from 'next/image'

import { FormBlock } from '@repo/website/src/blocks/form'
import type { Form } from '@payloadcms/plugin-form-builder/types'

interface Media {
  url: string
  alt: string
}

interface Benefit {
  icon: Media
  text: string
}

interface Feature {
  image: Media
  title: string
  description: string
}

interface CTA {
  title: string
  description: string
  form: Form & {
    fields: Array<{
      name: string
      label: string
      type: string
      required?: boolean
      blockType?: string
      defaultValue?: string
    }>
  }
}

interface GroupsBlockProps {
  heroImage: Media
  benefits?: Benefit[]
  features?: Feature[]
  cta: CTA
}

export const GroupsBlock: React.FC<GroupsBlockProps> = ({ heroImage, benefits, features, cta }) => {
  return (
    <div className="container mx-auto p-4 pt-28">
      <h1 className="mb-4 text-2xl font-medium md:mb-8 md:text-3xl">Personal Training</h1>
      <div className="grid-cols-1 grid-rows-4 gap-4 md:grid md:grid-cols-2 md:grid-rows-2 md:gap-x-40 md:gap-y-12">
        <div className="relative row-span-1 mb-6 aspect-video md:col-span-1">
          <Image
            className="rounded"
            src={heroImage.url}
            alt={heroImage.alt}
            fill
            sizes="100vw"
            style={{
              objectFit: 'cover',
            }}
          />
        </div>
        <div className="md:col-span-1 md:text-xl">
          <h3 className="mb-4 text-xl font-medium md:text-2xl">Who is this for?</h3>
          <div className="mb-6 md:pr-12 lg:pr-24">
            {benefits?.map((benefit, index) => (
              <div key={index} className="flex items-center">
                <div className="p-6">
                  <Image
                    src={benefit.icon.url}
                    alt={benefit.icon.alt}
                    width={40}
                    height={40}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                    }}
                  />
                </div>
                <p className="mb-2 font-light">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="md:pt-10 flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="md:w-1/2">
            <h5 className="mb-2 text-xl font-medium md:text-3xl">{cta.title}</h5>
            <p className="mb-8 text-xl font-light text-muted-foreground md:text-2xl">
              {cta.description}
            </p>
          </div>
          <div className="md:w-1/2">
            <FormBlock enableIntro={false} form={cta.form} />
          </div>
        </div>
      </div>
      <div className="mt-12 flex flex-wrap">
        {features?.map((feature, index) => (
          <div key={index} className="mb-12 md:w-1/3 md:px-2">
            <Image
              className="rounded"
              src={feature.image.url}
              alt={feature.image.alt}
              width={600}
              height={600}
              style={{
                maxWidth: '100%',
                height: 'auto',
                objectFit: 'cover',
              }}
            />
            <h5 className="my-2 text-2xl">{feature.title}</h5>
            <p className="text-gray-700">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
