'use client'

import React from 'react'
import { HeroBlock } from '@repo/website/src/blocks/hero/Component'
import { Schedule } from '@repo/bookings-next'
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

    // Debug: log the backgroundImage to see what we're receiving
    if (typeof window !== 'undefined') {
        console.log('HeroScheduleBlock - backgroundImage:', backgroundImage)
    }

    if (typeof backgroundImage === 'object' && backgroundImage !== null) {
        const media = backgroundImage as any // Use any to check all possible properties
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
                if (typeof window !== 'undefined') {
                    console.log('HeroScheduleBlock - transformed backgroundImage URL:', mediaUrl)
                }
            } else {
                if (typeof window !== 'undefined') {
                    console.warn('HeroScheduleBlock - getMediaUrl returned empty string for:', media.url)
                }
                transformedBackgroundImage = undefined
            }
        } else {
            // Media object but no url - might be unpopulated
            if (typeof window !== 'undefined') {
                console.warn('HeroScheduleBlock - backgroundImage is object but has no valid url property:', {
                    hasUrl: 'url' in media,
                    urlValue: media.url,
                    mediaKeys: Object.keys(media),
                    fullMedia: media
                })
            }
            transformedBackgroundImage = undefined
        }
    } else if (typeof backgroundImage === 'number') {
        // It's just an ID - media wasn't populated (need depth in query)
        if (typeof window !== 'undefined') {
            console.warn('HeroScheduleBlock - backgroundImage is a number (ID), not populated:', backgroundImage)
        }
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

    // Debug: log final transformed value
    if (typeof window !== 'undefined') {
        console.log('HeroScheduleBlock - Final transformedBackgroundImage:', transformedBackgroundImage)
    }

    return (
        <div className="flex flex-col lg:flex-row w-full">
            {/* Hero Section - Full width on mobile, half width on desktop */}
            <div className="w-full md:w-1/2 lg:w-2/3 flex-shrink-0 h-[600px] md:h-[700px]">
                <HeroBlock
                    backgroundImage={transformedBackgroundImage as any}
                    logo={transformedLogo}
                    title={title || undefined}
                    links={links || undefined}
                    disableInnerContainer={true}
                />
            </div>

            {/* Schedule Section - Full width on mobile, half width on desktop */}
            <div className="w-full md:w-1/2 lg:w-1/3 flex items-center justify-center p-4 lg:p-8 bg-white">
                <div className="w-full max-w-lg">
                    <h2 className="text-2xl font-medium text-center mb-4">Schedule</h2>
                    <Schedule />
                </div>
            </div>
        </div>
    )
}
