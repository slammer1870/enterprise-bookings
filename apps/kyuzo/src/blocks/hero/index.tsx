'use client'

import React from 'react'
import Link from 'next/link'

import type { Media } from '@/payload-types'

import type { Form } from '@payloadcms/plugin-form-builder/types'
import { FormBlock } from '@repo/website/src/blocks/form/index'

import { Button } from '@repo/ui/components/ui/button'

type HeroProps = {
  heading: string
  subheading: string
  cta1_text: string
  cta1_link: string
  cta2_text: string
  cta2_link: string
  formTitle: string
  formDescription: string
  backgroundImage: Media
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

export const HeroBlock: React.FC<HeroProps> = ({
  heading,
  subheading,
  cta1_text,
  cta1_link,
  cta2_text,
  cta2_link,
  formTitle,
  formDescription,
  backgroundImage,
  form,
}) => {
  return (
    <div
      className="relative z-10 flex min-h-screen flex-col bg-cover bg-no-repeat bg-top lg:flex-row"
      style={{ backgroundImage: `url(${backgroundImage.url})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white via-50% to-white lg:from-white/20 lg:via-white/70 lg:via-30% lg:to-white"></div>
      <div className="z-30 mx-auto flex grow items-center justify-center p-4 pt-32 lg:h-screen lg:w-2/3 lg:pt-0">
        <div className="absolute z-10 h-[200px] w-[200px] rounded-full bg-[#FEEBD4] opacity-60 md:h-[300px] md:w-[300px] lg:h-[400px] lg:w-[400px]"></div>
        <div className="z-50 max-w-md lg:max-w-2xl lg:p-4">
          <h1 className="mb-2 text-[2.15rem] font-medium leading-tight md:text-5xl lg:text-4xl">
            {heading}
          </h1>
          <p className="mb-4 text-xl text-gray-700 md:text-3xl lg:mb-6 lg:text-2xl">{subheading}</p>
          <div className="grid grid-cols-2 gap-4 md:text-lg xl:text-xl">
            <Button
              asChild
              size="lg"
              className="col-span-1 bg-[#E73F43] hover:bg-[#E73F43]/80 text-white xl:py-3"
            >
              <Link href={cta1_link}>{cta1_text}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="col-span-1 border border-[#E73F43] hover:bg-gray-100  bg-transparent text-black"
            >
              <Link href={cta2_link}>{cta2_text}</Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="z-30 flex items-center justify-center bg-white p-4 pb-12 text-gray-900 md:pb-24 lg:h-screen lg:w-full lg:max-w-xl lg:bg-[#E73F43] lg:pt-32 lg:text-white">
        <div className="w-full max-w-md lg:max-w-lg">
          <h3 className="text-xl md:text-2xl lg:text-3xl">{formTitle}</h3>
          <p className="mb-1 font-light md:text-lg lg:text-2xl lg:text-gray-100">
            {formDescription}
          </p>
          <FormBlock enableIntro={false} form={form} />
        </div>
      </div>
    </div>
  )
}
