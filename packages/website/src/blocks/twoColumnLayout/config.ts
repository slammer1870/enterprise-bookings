import type { Block } from 'payload'

/** Two-column layout with optional headings and nested blocks per column (same pattern as `threeColumnLayout`). */
export const createTwoColumnLayout = (availableBlocks: Block[]): Block => {
  const blockMap = new Map<string, Block>()
  availableBlocks.forEach((block) => {
    if (block.slug && !blockMap.has(block.slug) && block.slug !== 'twoColumnLayout') {
      blockMap.set(block.slug, block)
    }
  })
  const blocks = Array.from(blockMap.values())

  return {
    slug: 'twoColumnLayout',
    interfaceName: 'TwoColumnLayoutBlock',
    labels: {
      singular: 'Two Column Layout',
      plural: 'Two Column Layouts',
    },
    fields: [
      {
        name: 'leftColumnHeading',
        type: 'text',
        label: 'Left column heading',
        defaultValue: 'Column one',
      },
      {
        name: 'rightColumnHeading',
        type: 'text',
        label: 'Right column heading',
        defaultValue: 'Column two',
      },
      {
        name: 'leftBlocks',
        type: 'blocks',
        label: 'Left column',
        blocks,
        minRows: 0,
      },
      {
        name: 'rightBlocks',
        type: 'blocks',
        label: 'Right column',
        blocks,
        minRows: 0,
      },
    ],
  }
}
