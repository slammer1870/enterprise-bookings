import React from 'react'
import type { Media } from '@/payload-types'
import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'

import { FormBlock } from '@repo/website/src/blocks/form'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { OptimizedImage } from '@/components/OptimizedImage'

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
      <OptimizedImage
        media={backgroundImage}
        className="opacity-20"
        fill
        sizes="100vw"
        style={{
          objectFit: 'cover',
        }}
      />
      <div className="relative lg:absolute inset-0 bg-white/50">
        <div className="container relative mx-auto grid grid-cols-1 items-center gap-8 pt-8 pb-12 lg:min-h-screen lg:grid-cols-2 lg:gap-12 lg:py-20">
          <div className="mx-auto w-full max-w-md justify-self-center p-12 lg:mx-0 lg:justify-self-auto lg:p-0 lg:flex lg:justify-center">
            <OptimizedImage
              media={logo}
              height={600}
              width={600}
              className="h-auto w-full max-w-sm lg:max-w-md"
            />
          </div>

          <div className="w-full min-w-0 text-left">
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
    </section>
  )
}
