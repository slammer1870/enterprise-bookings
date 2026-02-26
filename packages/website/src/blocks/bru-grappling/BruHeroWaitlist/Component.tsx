'use client'

import React from 'react'
import Image from 'next/image'
import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { FormBlock } from '../../form'

type ImageLike =
  | {
      url?: string
      alt?: string
    }
  | number
  | string

function getImageUrl(image: ImageLike | undefined | null): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (typeof image === 'object' && image?.url) return image.url
  return null
}

function getImageAlt(image: ImageLike | undefined | null): string {
  if (!image) return ''
  if (typeof image === 'object') return image.alt || ''
  return ''
}

type CustomFormField = {
  name: string
  label: string
  type: string
  required?: boolean
  blockType?: string
  defaultValue?: string
}

export const BruHeroWaitlistBlock: React.FC<{
  backgroundImage: ImageLike
  logo: ImageLike
  title: string
  subtitle: string
  description: string
  form: FormType & {
    fields: CustomFormField[]
  }
  enableIntro?: boolean
  introContent?: SerializedEditorState
}> = ({ backgroundImage, logo, title, subtitle, description, form, enableIntro, introContent }) => {
  const bgUrl = getImageUrl(backgroundImage)
  const logoUrl = getImageUrl(logo)

  return (
    <section className="relative min-h-fit lg:min-h-screen z-10">
      {bgUrl && (
        <Image
          src={bgUrl}
          alt={getImageAlt(backgroundImage)}
          className="opacity-20"
          fill
          sizes="100vw"
          style={{ objectFit: 'cover' }}
        />
      )}
      <div className="relative lg:absolute inset-0 bg-white/50">
        <div className="container mx-auto px-4 pt-8 pb-12 lg:py-20 lg:flex lg:items-center lg:min-h-screen">
          <div className="flex flex-col items-center lg:flex-row lg:gap-12 lg:justify-between w-full">
            <div className="w-full max-w-md lg:w-1/2 lg:flex lg:justify-center p-12 lg:p-0">
              {logoUrl && (
                <Image
                  src={logoUrl}
                  alt={getImageAlt(logo)}
                  height={600}
                  width={600}
                  className="h-auto w-full max-w-sm lg:max-w-md"
                />
              )}
            </div>

            <div className="w-full lg:w-1/2 text-left">
              <div className="mb-6">
                <h1 className="text-lg font-medium text-gray-700">{title}</h1>
                <h2 className="mb-2 text-3xl font-medium uppercase leading-snug">{subtitle}</h2>
                <h3 className="mb-6 text-xl text-gray-700">{description}</h3>
              </div>

              <div className="space-y-4">
                {enableIntro && introContent && (
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

