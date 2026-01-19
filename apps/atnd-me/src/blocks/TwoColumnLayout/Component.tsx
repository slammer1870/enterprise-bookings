'use client'

import React from 'react'
import { AboutBlock } from '@repo/website/src/blocks/about'
import { LocationBlock } from '@repo/website/src/blocks/location'
import { FaqsBlock } from '@repo/website/src/blocks/faqs'
import { ScheduleBlock } from '@/blocks/Schedule/Component'

interface TwoColumnLayoutBlockProps {
  leftColumn?: {
    blockType: 'about' | 'schedule' | 'location' | 'faqs'
    block?: any
  }
  rightColumn?: Array<{
    blockType: 'about' | 'schedule' | 'location' | 'faqs'
    block?: any
  }>
  fullWidth?: {
    blockType: 'about' | 'schedule' | 'location' | 'faqs'
    block?: any
  }
}

const blockComponents = {
  about: AboutBlock,
  location: LocationBlock,
  schedule: ScheduleBlock,
  faqs: FaqsBlock,
}

// Helper function to get block data based on blockType
const getBlockData = (item: { blockType: string; [key: string]: any }) => {
  // Since we flattened the structure, all fields are at the same level
  // We need to map the field names and extract the relevant fields based on blockType
  const { blockType, ...rest } = item
  
  // Map field names based on blockType
  if (blockType === 'about') {
    return {
      title: rest.aboutTitle || 'About Us',
      image: rest.image,
      content: rest.content,
    }
  }
  
  if (blockType === 'location') {
    return {
      title: rest.locationTitle || 'Location',
      description: rest.description,
      address: rest.address,
      email: rest.email,
      phone: rest.phone,
      mapEmbedUrl: rest.mapEmbedUrl,
    }
  }
  
  if (blockType === 'faqs') {
    return {
      faqs: rest.faqs,
    }
  }
  
  // Schedule has no additional fields
  return {}
}

export const TwoColumnLayoutBlock: React.FC<TwoColumnLayoutBlockProps> = ({
  leftColumn,
  rightColumn,
  fullWidth,
}) => {
  return (
    <section className="container py-12">
      <div className="max-w-6xl mx-auto">
        {/* Two-column layout for left and right columns */}
        {(leftColumn || (rightColumn && rightColumn.length > 0)) && (
          <div className="flex flex-col md:flex-row gap-8 mb-8">
            {/* Left column */}
            {leftColumn && (
              <div className="w-full md:w-1/2">
                {(() => {
                  const Block = blockComponents[leftColumn.blockType as keyof typeof blockComponents]
                  if (!Block) return null
                  const blockData = getBlockData(leftColumn)
                  return (
                    <div key="left">
                      {/* @ts-expect-error there may be some mismatch between the expected types here */}
                      <Block {...blockData} disableInnerContainer />
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Right column */}
            {rightColumn && rightColumn.length > 0 && (
              <div className="w-full md:w-1/2 flex flex-col gap-8">
                {rightColumn.map((item, index) => {
                  const Block = blockComponents[item.blockType as keyof typeof blockComponents]
                  if (!Block) return null
                  const blockData = getBlockData(item)
                  return (
                    <div key={`right-${index}`}>
                      {/* @ts-expect-error there may be some mismatch between the expected types here */}
                      <Block {...blockData} disableInnerContainer />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Full width section */}
        {fullWidth && (
          <div className="w-full flex justify-center">
            <div className="w-full max-w-2xl">
              {(() => {
                const Block = blockComponents[fullWidth.blockType as keyof typeof blockComponents]
                if (!Block) return null
                const blockData = getBlockData(fullWidth)
                return (
                  <div key="fullwidth">
                    {/* @ts-expect-error there may be some mismatch between the expected types here */}
                    <Block {...blockData} disableInnerContainer />
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
