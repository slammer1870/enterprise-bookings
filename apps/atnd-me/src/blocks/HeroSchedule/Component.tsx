'use client'

import React from 'react'
import { HeroBlock } from '@repo/website/src/blocks/hero/Component'
import { ScheduleLazy } from '@/components/bookings/ScheduleLazy'
import type { Media } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'

interface HeroScheduleBlockProps {
    backgroundImage: number | Media | {
        url?: string
        alt?: string
    } | string
    logo?: (number | null) | Media | {
        url?: string
        alt?: string
    } | string
    title?: string | null
    links?: Array<{
        link: {
            type?: 'reference' | 'custom'
            url?: string
            label?: string
            appearance?: 'default' | 'outline'
            newTab?: boolean
            reference?: {
                value: string | number | { slug?: string }
                relationTo: string
            }
        }
    }> | null
}

export const HeroScheduleBlock: React.FC<HeroScheduleBlockProps> = ({
    backgroundImage,
    logo,
    title,
    links,
}) => {
    // Transform Media object to the format expected by HeroBlock
    // Payload Media objects have a url property when populated
    let transformedBackgroundImage: string | number | { url?: string; alt?: string } | undefined

    if (typeof backgroundImage === 'object' && backgroundImage !== null) {
        const media = backgroundImage as { url?: string; updatedAt?: string; alt?: string }
        // Check if it's a populated Media object with url property
        // Payload Media objects have url as a direct property when populated
        if (media.url && typeof media.url === 'string') {
            // Use getMediaUrl to ensure proper URL formatting (handles relative/absolute URLs)
            const mediaUrl = getMediaUrl(media.url, media.updatedAt)
            if (mediaUrl) {
                transformedBackgroundImage = {
                    url: mediaUrl,
                    alt: media.alt || undefined
                }
            } else {
                transformedBackgroundImage = undefined
            }
        } else {
            transformedBackgroundImage = undefined
        }
    } else if (typeof backgroundImage === 'number') {
        transformedBackgroundImage = backgroundImage
    } else if (typeof backgroundImage === 'string') {
        transformedBackgroundImage = backgroundImage
    } else {
        transformedBackgroundImage = undefined
    }

    let transformedLogo: string | number | { url?: string; alt?: string } | undefined

    if (logo && typeof logo === 'object' && logo !== null && 'url' in logo) {
        const media = logo as Media
        // Use getMediaUrl to ensure proper URL formatting
        const mediaUrl = media.url ? getMediaUrl(media.url, media.updatedAt) : undefined
        transformedLogo = {
            url: mediaUrl,
            alt: media.alt || undefined
        }
    } else if (logo && (typeof logo === 'number' || typeof logo === 'string')) {
        transformedLogo = logo
    } else {
        transformedLogo = undefined
    }

    return (
        <div className="flex flex-col md:flex-row w-full">
            {/* Hero Section - Full width on mobile, half width on desktop */}
            <div className="w-full md:w-1/2 lg:w-2/3 flex-shrink-0 h-[550px] md:h-[750px]">
                <HeroBlock
                    backgroundImage={
                      transformedBackgroundImage !== undefined
                        ? (transformedBackgroundImage as string | number | { url?: string; alt?: string })
                        : ''
                    }
                    logo={transformedLogo}
                    title={title || undefined}
                    links={links || undefined}
                    disableInnerContainer={true}
                />
            </div>

            {/* Schedule Section - Full width on mobile, half width on desktop */}
            <div className="w-full md:w-1/2 lg:w-1/3 flex items-center justify-center bg-background p-8 text-foreground lg:p-12">
                <div className="w-full max-w-lg">
                    <h2 className="mb-8 text-center text-3xl font-bold">Schedule</h2>
                    <ScheduleLazy />
                </div>
            </div>
        </div>
    )
}
