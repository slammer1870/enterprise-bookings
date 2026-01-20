import React from 'react'
import { getBlockComponentsRegistry } from './registry'

// Import the registry getter from the server-safe module

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

export const ThreeColumnLayoutBlock: React.FC<ThreeColumnLayoutBlockProps> = (props) => {
  const { blocks = [] } = props
  const blockComponents = getBlockComponentsRegistry() || {}

  if (!blocks || blocks.length === 0) {
    return null
  }

  // Calculate layout classes for each block
  const getBlockClasses = (index: number, total: number) => {
    // Small screens: single column (grid-cols-1)
    // Medium screens: 2 columns on first row, 1 centered on second row
    // Large screens: 3 columns (grid-cols-3)

    let classes = ''

    // For medium screens (md:)
    if (index < 2) {
      // First two blocks: each takes 1/2 width (2 columns side by side)
      classes = 'md:col-span-1'
    } else {
      // Third block and beyond: span full width (2 columns) and center
      classes = 'md:col-span-2 md:flex md:justify-center'
    }

    // For large screens (lg:)
    // All blocks take 1 column in 3-column grid
    classes += ' lg:col-span-1 lg:flex-none'

    return classes
  }

  return (
    <section className="container py-12 mx-auto">
      <div className="mx-auto">
        {/* Small screens: single column stack */}
        {/* Medium screens: 2 columns on first row, 1 centered on second row */}
        {/* Large screens: 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blocks.map((block, index) => {
            const { blockType, id } = block

            if (blockType && blockType in blockComponents) {
              const Block = blockComponents[blockType as keyof typeof blockComponents]

              if (Block) {
                const blockClasses = getBlockClasses(index, blocks.length)
                const blockKey = id || `block-${index}`

                return (
                  <div key={blockKey} className={blockClasses}>
                    {index >= 2 ? (
                      <div className="w-full max-w-md mx-auto">
                        <Block {...block} disableInnerContainer />
                      </div>
                    ) : (
                      <Block {...block} disableInnerContainer />
                    )}
                  </div>
                )
              }
            }
            return null
          })}
        </div>
      </div>
    </section>
  )
}
