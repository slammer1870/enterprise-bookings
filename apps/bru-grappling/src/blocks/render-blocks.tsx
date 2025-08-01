import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { HeroBlock } from './hero'
import { AboutBlock } from './about'
import { LearningBlock } from './learning'
import { MeetTheTeamBlock } from './meet-the-team'
import { ScheduleBlock } from './schedule'

const blockComponents = {
  hero: HeroBlock,
  about: AboutBlock,
  learning: LearningBlock,
  meetTheTeam: MeetTheTeamBlock,
  schedule: ScheduleBlock,
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
