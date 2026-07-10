const LAYOUT_BLOCK_TYPES = new Set(['twoColumnLayout', 'threeColumnLayout'])

const FULL_BLEED_BLOCK_TYPES = new Set([
  'hero',
  'hero-waitlist',
  'heroScheduleSanctuary',
  'heroWithLocation',
  'clHeroLoc',
  'bruHero',
  'bruHeroWaitlist',
  'bruAbout',
  'clFindSanctuary',
  'dhHero',
  'marketingHero',
])

/** Horizontal padding for top-level page blocks; layout and full-bleed blocks manage their own. */
export function getRenderBlockWrapperClassName(blockType: string): string | undefined {
  if (LAYOUT_BLOCK_TYPES.has(blockType) || FULL_BLEED_BLOCK_TYPES.has(blockType)) {
    return undefined
  }
  return 'container mx-auto'
}
