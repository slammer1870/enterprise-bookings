import React from 'react'
import Image from 'next/image'
import type { Media } from '@/payload-types'
import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'

import { FormBlock } from '@repo/website/src/blocks/form'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

export const HeroWaitlistBlock: React.FC<{
  backgroundImage: Media
  logo: Media
  title: string
  subtitle: string
  description: string
  form: FormType & {
    fields: Array<{
      name: string
      label: string
      type: string
      required?: boolean
      blockType?: string
      defaultValue?: string
    }>
  }
  enableIntro: boolean
  introContent: SerializedEditorState
}> = ({ backgroundImage, logo, title, subtitle, description, form, enableIntro, introContent }) => {
  return (
    <section className="relative min-h-fit lg:min-h-screen z-10">
      <Image
        src={backgroundImage.url || ''}
        alt={backgroundImage.alt}
        className="opacity-20"
        fill
        sizes="100vw"
        style={{
          objectFit: 'cover',
        }}
      />
      <div className="relative lg:absolute inset-0 bg-white bg-opacity-50">
        <div className="container mx-auto px-4 py-8 lg:py-20 lg:flex lg:items-center lg:min-h-screen">
          <div className="flex flex-col items-center lg:flex-row lg:gap-12 lg:justify-between w-full">
            {/* Logo Section */}
            <div className="w-full max-w-md lg:w-1/2 lg:flex lg:justify-center mb-8 lg:mb-0 p-8 lg:p-0">
              <Image
                src={logo.url || ''}
                alt={logo.alt || ''}
                height={600}
                width={600}
                className="h-auto w-full max-w-sm lg:max-w-md"
                unoptimized
              />
            </div>

            {/* Content Section */}
            <div className="w-full lg:w-1/2 text-left">
              <div className="mb-6">
                <h1 className="text-lg font-medium text-gray-700">{title}</h1>
                <h2 className="mb-2 text-3xl font-medium uppercase leading-snug">{subtitle}</h2>
                <h3 className="mb-6 text-xl text-gray-700">{description}</h3>
              </div>

              <div className="space-y-4">
                {enableIntro && (
                  <div>
                    <RichText data={introContent} className="prose prose-h3::m-0 w-full" />
                  </div>
                )}
                <div className="w-full">
                  <FormBlock enableIntro={true} form={form} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
