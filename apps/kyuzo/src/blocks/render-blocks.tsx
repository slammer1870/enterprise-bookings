import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { HeroBlock } from './hero'
import { AboutBlock } from './about'
import { KidsProgramBlock } from './kids-program'
import { AdultsProgramBlock } from './adults-program'
import { CoachingTeamBlock } from './coaching-team'
import { ContactFormBlock } from './contact-form'
import { LatestPostsBlock } from './latest-posts'

import ScheduleComponent from '@/components/schedule'

import { FormBlock } from '@repo/website/src/blocks/form/index'
import { ContentBlock } from '@repo/website/src/blocks/content/index'
import { getRenderBlockWrapperClassName } from '@repo/website/src/blocks/getRenderBlockWrapperClassName'

const blockComponents = {
  hero: HeroBlock,
  about: AboutBlock,
  'kids-program': KidsProgramBlock,
  'adults-program': AdultsProgramBlock,
  'coaching-team': CoachingTeamBlock,
  'contact-form': ContactFormBlock,
  'latest-posts': LatestPostsBlock,
  'form-block': FormBlock,
  content: ContentBlock,
  schedule: ScheduleComponent,
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
