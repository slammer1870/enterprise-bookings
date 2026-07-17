import React from 'react'
import { resolveBlockComponent } from './registry'

interface ThreeColumnLayoutBlockProps {
  blocks?: Array<{
    blockType: string
    [key: string]: any
  }>
  blockType?: string
  id?: string
  blockName?: string
  [key: string]: any
}

export async function ThreeColumnLayoutBlock(props: ThreeColumnLayoutBlockProps) {
  const { blocks = [] } = props

  if (!blocks || blocks.length === 0) {
    return null
  }

  const getBlockClasses = (index: number, _total: number) => {
    let classes = ''

    if (index < 2) {
      classes = 'md:col-span-1'
    } else {
      classes = 'md:col-span-2 md:flex md:justify-center'
    }

    classes += ' lg:col-span-1 lg:flex-none'

    return classes
  }

  const rendered = await Promise.all(
    blocks.map(async (block, index) => {
      const { blockType, id } = block
      if (!blockType) return null

      const Block = await resolveBlockComponent(blockType)
      if (!Block) return null

      const blockClasses = getBlockClasses(index, blocks.length)
      const blockKey = id || `block-${index}`

      return (
        <div key={blockKey} className={blockClasses}>
          {index >= 2 ? (
            <div className="w-full max-w-md mx-auto">
              <Block
                {...block}
                {...(blockType === 'twoColumnLayout' ? { nested: true } : {})}
              />
            </div>
          ) : (
            <Block
              {...block}
              {...(blockType === 'twoColumnLayout' ? { nested: true } : {})}
            />
          )}
        </div>
      )
    }),
  )

  return (
    <section className="container mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{rendered}</div>
    </section>
  )
}
