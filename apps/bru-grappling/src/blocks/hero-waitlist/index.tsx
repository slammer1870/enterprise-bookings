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
    <section className="relative min-h-screen z-10">
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
      <div className="absolute flex h-full w-full items-center justify-center bg-white bg-opacity-50">
        <div className="container relative mx-auto flex min-h-screen flex-col flex-wrap items-center justify-start py-20 px-4 lg:-mt-20 lg:mb-0 lg:flex-row gap-4">
          <div className="mx-auto w-2/3 lg:w-1/2 xl:w-auto">
            <Image
              src={logo.url || ''}
              alt={logo.alt || ''}
              height={600}
              width={600}
              className="h-auto max-w-full p-4 lg:p-12"
              unoptimized
              style={{
                maxWidth: '100%',
                height: 'auto',
              }}
            />
          </div>
          <div className="lg:w-1/2">
            <div className="mb-8 lg:mb-0">
              <h1 className="text-lg font-medium text-gray-700">{title}</h1>
              <h2 className="mb-2 text-3xl font-medium uppercase leading-snug">{subtitle}</h2>
              <h3 className="mb-8 text-xl text-gray-700">{description}</h3>
            </div>
            <div className="w-full flex flex-col gap-4 justify-start items-start">
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
    </section>
  )
}
