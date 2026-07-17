import React from 'react'

import { resolveBlockComponent } from '../threeColumnLayout/registry'

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
  /** When nested inside a layout block, stack columns vertically. */
  nested?: boolean
  blockType?: string
  id?: string
  blockName?: string
}

async function renderColumnBlocks(blocks: NestedBlock[] | undefined) {
  const list = blocks ?? []

  if (list.length === 0) {
    return null
  }

  const rendered = await Promise.all(
    list.map(async (block, index) => {
      const { blockType, id } = block
      if (!blockType) return null

      const Block = await resolveBlockComponent(blockType)
      if (!Block) return null

      const key = id ?? `nested-${index}`
      return (
        <Block
          key={key}
          {...block}
          {...(blockType === 'twoColumnLayout' ? { nested: true } : {})}
        />
      )
    }),
  )

  return <div className="flex flex-col gap-6">{rendered}</div>
}

export async function TwoColumnLayoutBlock({
  leftColumnHeading = 'Column one',
  rightColumnHeading = 'Column two',
  leftBlocks,
  rightBlocks,
  nested,
}: TwoColumnLayoutBlockProps) {
  const [left, right] = await Promise.all([
    renderColumnBlocks(leftBlocks),
    renderColumnBlocks(rightBlocks),
  ])

  if (!left && !right) {
    return null
  }

  const gridClass = nested
    ? 'grid grid-cols-1 gap-1 items-start'
    : 'grid grid-cols-1 gap-1 items-start md:grid-cols-2 md:gap-4'
  const wrapperClass = nested ? 'w-full pt-12' : 'container mx-auto pt-24 sm:pt-28'

  return (
    <section className={wrapperClass}>
      <div className={gridClass}>
        <div className="w-full pb-2">
          {leftColumnHeading ? (
            <h2 className="mb-3 text-center text-2xl font-medium">{leftColumnHeading}</h2>
          ) : null}
          {left}
        </div>
        <div className="w-full pb-2">
          {rightColumnHeading ? (
            <h2 className="mb-3 text-center text-2xl font-medium">{rightColumnHeading}</h2>
          ) : null}
          {right}
        </div>
      </div>
    </section>
  )
}
