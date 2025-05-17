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
      <div className="grid gap-4 md:grid-cols-2 md:gap-x-40 md:gap-y-12">
        <div className="relative mb-6 aspect-video md:mb-0">
          <Image
            className="rounded object-cover"
            src={heroImage.url}
            alt={heroImage.alt}
            fill
            sizes="100vw"
          />
        </div>
        <div className="md:text-xl">
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
                    className="max-w-full h-auto"
                  />
                </div>
                <p className="mb-2 font-light">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 md:col-span-2 md:flex-row md:items-center md:justify-between md:py-10">
          <div>
            <h3 className="mb-2 text-xl font-medium md:text-3xl">{cta.title}</h3>
            <p className="mb-8 text-xl font-light text-muted-foreground md:text-2xl">
              {cta.description}
            </p>
          </div>
          <div className="w-full md:w-1/2">
            <FormBlock enableIntro={false} form={cta.form} />
          </div>
        </div>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {features?.map((feature, index) => (
          <div key={index} className="flex flex-col items-start gap-4">
            <div className="relative w-full aspect-square">
              <Image
                className="rounded object-cover"
                src={feature.image.url}
                alt={feature.image.alt}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority={index === 0}
              />
            </div>
            <div className="text-left">
              <h5 className="my-2 text-2xl">{feature.title}</h5>
              <p className="text-gray-700">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
