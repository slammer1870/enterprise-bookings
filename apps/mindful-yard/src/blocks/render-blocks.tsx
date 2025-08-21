import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { HeroBlock } from './hero'

import { ScheduleBlock } from './schedule'
import { LocationBlock } from './location'
import { FaqsBlock } from '@repo/website/src/blocks/faqs'

const blockComponents = {
  hero: HeroBlock,
  schedule: ScheduleBlock,
  location: LocationBlock,
  faqs: FaqsBlock,
}

export const RenderBlocks: React.FC<{
  blocks: Page['layout']
}> = (props) => {
  const { blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block: any, index) => {
          const { blockType } = block
          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType as keyof typeof blockComponents]

            if (Block) {
              return (
                <div key={index}>
                  <Block {...block} disableInnerContainer />
                </div>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
