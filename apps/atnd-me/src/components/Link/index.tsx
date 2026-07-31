import { cn } from '@/utilities/ui'
import Link from 'next/link'
import React from 'react'
import { CMSButton, type CMSButtonProps } from '@repo/website'

import type { Page, Post } from '@/payload-types'

type CMSLinkType = {
  appearance?: 'inline' | NonNullable<CMSButtonProps['appearance']> | 'destructive' | null
  backgroundColor?: string | null
  children?: React.ReactNode
  className?: string
  foregroundColor?: string | null
  label?: string | null
  newTab?: boolean | null
  reference?: {
    relationTo: 'pages' | 'posts'
    value: Page | Post | string | number
  } | null
  size?: CMSButtonProps['size'] | 'clear' | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

export const CMSLink: React.FC<CMSLinkType> = (props) => {
  const {
    type,
    appearance = 'inline',
    backgroundColor,
    children,
    className,
    foregroundColor,
    label,
    newTab,
    reference,
    size: sizeFromProps,
    url,
  } = props

  const href =
    type === 'reference' && typeof reference?.value === 'object' && reference.value.slug
      ? `${reference?.relationTo !== 'pages' ? `/${reference?.relationTo}` : ''}/${
          reference.value.slug
        }`
      : url

  if (!href) return null

  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  /* Ensure we don't break any styles set by richText */
  if (appearance === 'inline') {
    return (
      <Link className={cn(className)} href={href || url || ''} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    )
  }

  const size = sizeFromProps === 'clear' || appearance === 'link' ? 'default' : sizeFromProps

  return (
    <CMSButton
      appearance={appearance === 'destructive' ? 'default' : appearance}
      backgroundColor={backgroundColor}
      className={className}
      foregroundColor={foregroundColor}
      label={label}
      newTab={newTab}
      reference={reference}
      size={size}
      type={type}
      url={url}
    >
      {children}
    </CMSButton>
  )
}
