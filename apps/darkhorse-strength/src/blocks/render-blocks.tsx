import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { HeroBlock } from './hero'
import { TeamBlock } from './team'
import { TimetableBlock } from './timetable'
import { TestimonialsBlock } from './testimonials'
import { PricingBlock } from './pricing'
import { ContactBlock } from './contact'
import { GroupsBlock } from './groups'

import { FormBlock } from '@repo/website/src/blocks/form/index'
import { getRenderBlockWrapperClassName } from '@repo/website/src/blocks/getRenderBlockWrapperClassName'

const blockComponents = {
  hero: HeroBlock,
  team: TeamBlock,
  timetable: TimetableBlock,
  testimonials: TestimonialsBlock,
  pricing: PricingBlock,
  contact: ContactBlock,
  groups: GroupsBlock,
  'form-block': FormBlock,
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
              const wrapperClassName = getRenderBlockWrapperClassName(blockType)
              return (
                <div key={index} className={wrapperClassName}>
                  <Block {...block} />
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
