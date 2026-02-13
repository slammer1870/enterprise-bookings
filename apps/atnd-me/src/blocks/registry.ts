/**
 * Block registry for tenant-scoped blocks (Phase 3).
 * Default blocks are available to all tenants; super admin can enable extra blocks per tenant.
 */
import type { Block } from 'payload'
import { Archive } from './ArchiveBlock/config'
import { CallToAction } from './CallToAction/config'
import { Content } from './Content/config'
import { FormBlock } from './Form/config'
import { MediaBlock } from './MediaBlock/config'
import { HealthBenefits } from './HealthBenefits/config'
import { HeroSchedule } from './HeroSchedule/config'
import { HeroScheduleSanctuary } from './HeroScheduleSanctuary/config'
import { Schedule } from './Schedule/config'
import { TenantScopedSchedule } from './TenantScopedSchedule/config'
import { SectionTagline } from './SectionTagline/config'
import { Hero, About, Location, Faqs, createThreeColumnLayout } from '@repo/website'

const allBlocks: Block[] = [
  HeroSchedule,
  HeroScheduleSanctuary,
  Hero,
  About,
  Location,
  Schedule,
  TenantScopedSchedule,
  HealthBenefits,
  SectionTagline,
  Faqs,
  CallToAction,
  Content,
  MediaBlock,
  Archive,
  FormBlock,
]

const ThreeColumnLayout = createThreeColumnLayout(allBlocks)

/** Block slugs that all tenants always have access to. */
export const defaultBlockSlugs: string[] = [
  'heroSchedule',
  'hero',
  'about',
  'schedule',
  'tenantScopedSchedule', // Root home page: filter schedule by tenant
  'content',
  'cta',
]

/** Map of block slug to block config. Includes threeColumnLayout. */
const blockMap = new Map<string, Block>()
allBlocks.forEach((b) => {
  if (b.slug && !blockMap.has(b.slug)) blockMap.set(b.slug, b)
})
blockMap.set('threeColumnLayout', ThreeColumnLayout)

/** Get block config by slug. */
export function getBlockBySlug(slug: string): Block | undefined {
  return blockMap.get(slug)
}

/** All block slugs in the registry. */
export const allBlockSlugs: string[] = Array.from(blockMap.keys())

/** Block slugs that super admin can optionally enable per tenant (all minus defaults). */
export const extraBlockSlugs: string[] = allBlockSlugs.filter((s) => !defaultBlockSlugs.includes(s))

/** Get all block configs from the registry. */
export function getAllBlocks(): Block[] {
  return Array.from(blockMap.values())
}
