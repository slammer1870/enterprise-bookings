import React, { Fragment, Suspense } from 'react'

import type { Page } from '@/payload-types'

import { blockLoaders } from './blockComponents'
import { getRenderBlockWrapperClassName } from '@repo/website/src/blocks/getRenderBlockWrapperClassName'
import { registerBlockLoaders } from '@repo/website/src/blocks/threeColumnLayout'

// Nested layout blocks resolve children through the same lazy loaders.
registerBlockLoaders(blockLoaders)

type LayoutBlock = Page['layout'][0]

async function renderOneBlock(block: LayoutBlock, index: number) {
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
}

async function DeferredBlocks({
  blocks,
  startIndex,
}: {
  blocks: LayoutBlock[]
  startIndex: number
}) {
  const rendered = await Promise.all(
    blocks.map((block, i) => renderOneBlock(block, startIndex + i)),
  )
  return <Fragment>{rendered}</Fragment>
}

/**
 * Stream the first (usually hero) block immediately; defer the rest so LCP
 * is not blocked on below-the-fold dynamic imports.
 */
export async function RenderBlocks(props: { blocks: Page['layout'][0][] }) {
  const { blocks } = props

  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return null
  }

  const [first, ...rest] = blocks
  const firstRendered = first ? await renderOneBlock(first, 0) : null

  return (
    <Fragment>
      {firstRendered}
      {rest.length > 0 ? (
        <Suspense fallback={null}>
          <DeferredBlocks blocks={rest} startIndex={1} />
        </Suspense>
      ) : null}
    </Fragment>
  )
}
