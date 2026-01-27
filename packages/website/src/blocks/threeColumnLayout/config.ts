import type { Block } from 'payload'

// Create three column layout block using Payload's native blocks field type
// This provides the native Payload blocks UI with block selection and conditional fields
export const createThreeColumnLayout = (
  availableBlocks: Block[]
): Block => {
  // Deduplicate blocks by slug to avoid processing the same block multiple times
  // Exclude self to prevent infinite recursion
  const blockMap = new Map<string, Block>()
  availableBlocks.forEach((block) => {
    if (block.slug && !blockMap.has(block.slug) && block.slug !== 'threeColumnLayout') {
      blockMap.set(block.slug, block)
    }
  })
  const blocks = Array.from(blockMap.values())

  // Use Payload's native blocks field type
  // This provides the native Payload blocks UI with:
  // - Block selection dropdown/selector
  // - Automatic conditional field display based on selected block
  // - Proper block data structure
  return {
    slug: 'threeColumnLayout',
    interfaceName: 'ThreeColumnLayoutBlock',
    labels: {
      singular: 'Three Column Layout',
      plural: 'Three Column Layouts',
    },
    fields: [
      {
        name: 'blocks',
        type: 'blocks',
        label: 'Blocks',
        minRows: 1,
        blocks: blocks, // Payload automatically handles block selection UI and conditional fields
      },
    ],
  }
}
