import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { blockComponents } from './blockComponents'
import { registerBlockComponents } from '@repo/website/src/blocks/threeColumnLayout'

// Register block components on the server side
// This ensures the registry is available for ThreeColumnLayoutBlock when it renders
registerBlockComponents(blockComponents)

export const RenderBlocks: React.FC<{
  blocks: Page['layout'][0][]
}> = (props) => {
  const { blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
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
