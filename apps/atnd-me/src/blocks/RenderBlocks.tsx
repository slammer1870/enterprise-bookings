import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { blockLoaders } from './blockComponents'
import { getRenderBlockWrapperClassName } from '@repo/website/src/blocks/getRenderBlockWrapperClassName'
import { registerBlockLoaders } from '@repo/website/src/blocks/threeColumnLayout'

// Nested layout blocks resolve children through the same lazy loaders.
registerBlockLoaders(blockLoaders)

export async function RenderBlocks(props: { blocks: Page['layout'][0][] }) {
  const { blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (!hasBlocks) {
    return null
  }

  const rendered = await Promise.all(
    blocks.map(async (block, index) => {
      const { blockType } = block
      if (!blockType) return null

      const loader = blockLoaders[blockType]
      if (!loader) return null

      const Block = await loader()
      const wrapperClassName = getRenderBlockWrapperClassName(blockType)
      return (
        <div key={index} className={wrapperClassName}>
          <Block {...block} />
        </div>
      )
    }),
  )

  return <Fragment>{rendered}</Fragment>
}
