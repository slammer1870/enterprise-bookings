import type { Block } from 'payload'
import {
  defaultBlockSlugs,
  getBlockBySlug,
} from '../blocks/registry'

/**
 * Returns block configs allowed for a tenant.
 * Default blocks are always included; tenant.allowedBlocks adds extra blocks.
 */
export function getBlocksForTenant(allowedBlocks?: string[] | null): Block[] {
  const extra = (allowedBlocks ?? []).filter(Boolean)
  const slugs = [...new Set([...defaultBlockSlugs, ...extra])]
  const blocks: Block[] = []
  for (const slug of slugs) {
    const block = getBlockBySlug(slug)
    if (block) blocks.push(block)
  }
  return blocks
}
