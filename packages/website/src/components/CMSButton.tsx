import React from 'react'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'
import { cn } from '@repo/ui/lib/utils'
import { getLinkHref } from '../utils/getLinkHref'
import { resolveColorToken } from '../admin/colorTokens'
import type { LinkAppearances } from '../fields/linkTypes'

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'

export type CMSButtonProps = {
  appearance?: LinkAppearances | null
  backgroundColor?: string | null
  children?: React.ReactNode
  className?: string
  foregroundColor?: string | null
  label?: string | null
  newTab?: boolean | null
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
  reference?: {
    relationTo: string
    value: string | number | { slug?: string }
  } | null
  size?: ButtonSize | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

function toButtonVariant(appearance: LinkAppearances | null | undefined): ButtonVariant {
  switch (appearance) {
    case 'outline':
    case 'secondary':
    case 'ghost':
    case 'link':
      return appearance
    case 'default':
    default:
      return 'default'
  }
}

export function CMSButton({
  appearance = 'default',
  backgroundColor,
  children,
  className,
  foregroundColor,
  label,
  newTab,
  onClick,
  reference,
  size = 'default',
  type,
  url,
}: CMSButtonProps) {
  const href = getLinkHref({
    type: type ?? undefined,
    url: url ?? undefined,
    reference: reference ?? undefined,
  })

  if (!href && !url && !label && !children) return null

  const resolvedHref = href || url || '#'
  const variant = toButtonVariant(appearance)
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' as const } : {}

  const bg = resolveColorToken(backgroundColor)
  const fg = resolveColorToken(foregroundColor)
  const style: React.CSSProperties = {}
  if (bg) {
    if (variant === 'outline') {
      style.borderColor = bg
      style.backgroundColor = 'transparent'
    } else {
      style.backgroundColor = bg
    }
  }
  if (fg) {
    style.color = fg
  }

  return (
    <Button
      asChild
      className={cn(className)}
      size={size ?? 'default'}
      style={Object.keys(style).length > 0 ? style : undefined}
      variant={variant}
    >
      <Link href={resolvedHref} onClick={onClick} {...newTabProps}>
        {label}
        {children}
      </Link>
    </Button>
  )
}
