import React from 'react'

import { getBlockComponentsRegistry } from '../threeColumnLayout/registry'

type NestedBlock = {
  blockType: string
  id?: string
  [key: string]: unknown
}

export type TwoColumnLayoutBlockProps = {
  leftColumnHeading?: string | null
  rightColumnHeading?: string | null
  leftBlocks?: NestedBlock[]
  rightBlocks?: NestedBlock[]
  disableInnerContainer?: boolean
  blockType?: string
  id?: string
  blockName?: string
}

function renderColumnBlocks(blocks: NestedBlock[] | undefined) {
  const list = blocks ?? []
  const blockComponents = getBlockComponentsRegistry() || {}

  if (list.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      {list.map((block, index) => {
        const { blockType, id } = block
        if (!blockType || !(blockType in blockComponents)) {
          return null
        }
        const Block = blockComponents[blockType as keyof typeof blockComponents]
        if (!Block) {
          return null
        }
        const key = id ?? `nested-${index}`
        return <Block key={key} {...block} disableInnerContainer />
      })}
    </div>
  )
}

export const TwoColumnLayoutBlock: React.FC<TwoColumnLayoutBlockProps> = ({
  leftColumnHeading = 'Column one',
  rightColumnHeading = 'Column two',
  leftBlocks,
  rightBlocks,
  disableInnerContainer,
}) => {
  const left = renderColumnBlocks(leftBlocks)
  const right = renderColumnBlocks(rightBlocks)

  if (!left && !right) {
    return null
  }

  // When nested inside another layout block, always stack vertically and omit the
  // standalone top padding that clears the fixed header.
  const gridClass = disableInnerContainer ? 'grid grid-cols-1 gap-1 items-start' : 'grid grid-cols-1 gap-1 items-start md:grid-cols-2 md:gap-4'
  const wrapperClass = disableInnerContainer
    ? 'w-full pt-12'
    : 'mx-auto w-full max-w-7xl px-4 pt-24 sm:pt-28'

  return (
    <section className={wrapperClass}>
      <div className={gridClass}>
        <div className="w-full px-2 pb-2">
          {leftColumnHeading ? (
            <h2 className="mb-3 text-center text-2xl font-medium">{leftColumnHeading}</h2>
          ) : null}
          {left}
        </div>
        <div className="w-full px-2 pb-2">
          {rightColumnHeading ? (
            <h2 className="mb-3 text-center text-2xl font-medium">{rightColumnHeading}</h2>
          ) : null}
          {right}
        </div>
      </div>
    </section>
  )
}
