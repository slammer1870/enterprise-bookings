'use client'

import React from 'react'
import Link from 'next/link'

import { FormBlock } from '../form'
import { Button } from '@repo/ui/components/ui/button'

type MediaLike = { url?: string | null } | number | string | null | undefined

type FormLike = {
  fields: Array<{
    name: string
    label: string
    type: string
    required?: boolean
    blockType?: string
    defaultValue?: string
  }>
}

type KyuzoHeroProps = {
  heading: string
  subheading: string
  cta1_text?: string
  cta1_link?: string
  cta1_style?: 'filled' | 'outline'
  cta1_backgroundColor?: string
  cta1_textColor?: string
  cta1_borderColor?: string
  cta2_text?: string
  cta2_link?: string
  cta2_style?: 'filled' | 'outline'
  cta2_backgroundColor?: string
  cta2_textColor?: string
  cta2_borderColor?: string
  formTitle: string
  formDescription: string
  backgroundImage: MediaLike
  form: FormLike
  panelBackgroundColor?: string
  overlayColor?: string
  overlayOpacity?: number
}

function getImageUrl(image: MediaLike): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (typeof image === 'object') return image.url ?? null
  return null
}

export const KyuzoHeroBlock: React.FC<KyuzoHeroProps> = ({
  heading,
  subheading,
  cta1_text,
  cta1_link,
  cta1_style,
  cta1_backgroundColor,
  cta1_textColor,
  cta1_borderColor,
  cta2_text,
  cta2_link,
  cta2_style,
  cta2_backgroundColor,
  cta2_textColor,
  cta2_borderColor,
  formTitle,
  formDescription,
  backgroundImage,
  form,
  panelBackgroundColor,
  overlayColor,
  overlayOpacity,
}) => {
  const imageUrl = getImageUrl(backgroundImage)
  const useCustomOverlay = overlayColor || overlayOpacity !== undefined
  const overlayStyle = useCustomOverlay
    ? {
        backgroundColor: overlayColor || '#FFFFFF',
        opacity: overlayOpacity ?? 1,
      }
    : undefined

  const renderCTA = ({
    text,
    link,
    style,
    backgroundColor,
    textColor,
    borderColor,
    defaultStyle,
    defaultBackgroundColor,
    defaultTextColor,
    defaultBorderColor,
  }: {
    text?: string
    link?: string
    style?: 'filled' | 'outline'
    backgroundColor?: string
    textColor?: string
    borderColor?: string
    defaultStyle: 'filled' | 'outline'
    defaultBackgroundColor: string
    defaultTextColor: string
    defaultBorderColor: string
  }) => {
    if (!text || !link) return null

    const buttonStyle = style ?? defaultStyle
    const isOutline = buttonStyle === 'outline'

    return (
      <Button
        asChild
        size="lg"
        className={`col-span-1 xl:py-3 ${isOutline ? 'border bg-transparent hover:bg-gray-100' : 'hover:opacity-80'}`}
        style={{
          backgroundColor: backgroundColor ?? (isOutline ? undefined : defaultBackgroundColor),
          color: textColor ?? defaultTextColor,
          borderColor: borderColor ?? defaultBorderColor,
        }}
      >
        <Link href={link}>{text}</Link>
      </Button>
    )
  }

  return (
    <div
      className="relative z-10 flex min-h-screen flex-col bg-cover bg-no-repeat bg-top lg:flex-row"
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      <div
        className={
          useCustomOverlay
            ? 'absolute inset-0'
            : 'absolute inset-0 bg-gradient-to-b from-white/20 via-white via-50% to-white lg:from-white/50 lg:via-white/90 lg:via-30% lg:to-white'
        }
        style={overlayStyle}
      />
      <div className="z-30 mx-auto flex grow items-center justify-center p-6 pt-32 md:p-8 lg:h-screen lg:w-2/3 lg:pt-0">
        <div className="absolute z-10 h-[200px] w-[200px] rounded-full bg-[#FEEBD4] opacity-60 md:h-[300px] md:w-[300px] lg:h-[400px] lg:w-[400px]" />
        <div className="z-50 max-w-md lg:max-w-2xl lg:p-6">
          <h1 className="mb-2 text-[2.15rem] font-medium leading-tight md:text-5xl lg:text-4xl">
            {heading}
          </h1>
          <p className="mb-4 text-xl text-gray-700 md:text-3xl lg:mb-6 lg:text-2xl">{subheading}</p>
          <div className="grid grid-cols-2 gap-4 md:text-lg xl:text-xl">
            {renderCTA({
              text: cta1_text,
              link: cta1_link,
              style: cta1_style,
              backgroundColor: cta1_backgroundColor,
              textColor: cta1_textColor,
              borderColor: cta1_borderColor,
              defaultStyle: 'filled',
              defaultBackgroundColor: '#E73F43',
              defaultTextColor: '#FFFFFF',
              defaultBorderColor: '#E73F43',
            })}
            {renderCTA({
              text: cta2_text,
              link: cta2_link,
              style: cta2_style,
              backgroundColor: cta2_backgroundColor,
              textColor: cta2_textColor,
              borderColor: cta2_borderColor,
              defaultStyle: 'outline',
              defaultBackgroundColor: '#E73F43',
              defaultTextColor: '#000000',
              defaultBorderColor: '#E73F43',
            })}
          </div>
        </div>
      </div>
      <div
        className="z-30 flex items-center justify-center bg-white p-6 pb-12 text-gray-900 md:p-8 md:pb-24 lg:h-screen lg:w-full lg:max-w-xl lg:bg-[#E73F43] lg:pt-32 lg:text-white"
        style={panelBackgroundColor ? { backgroundColor: panelBackgroundColor } : undefined}
      >
        <div className="w-full max-w-md lg:max-w-lg">
          <h3 className="text-xl md:text-2xl lg:text-3xl">{formTitle}</h3>
          <p className="mb-1 font-light md:text-lg lg:text-2xl lg:text-gray-100">{formDescription}</p>
          <FormBlock enableIntro={false} form={form as never} />
        </div>
      </div>
    </div>
  )
}
