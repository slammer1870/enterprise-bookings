import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { HeroBlock } from './hero'
import { AboutBlock } from './about'

import ScheduleComponent from '@/components/schedule'

import { FormBlock } from '@repo/website/src/blocks/form/index'

const blockComponents = {
  hero: HeroBlock,
  about: AboutBlock,
  'form-block': FormBlock,
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
              return (
                <div key={index}>
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
