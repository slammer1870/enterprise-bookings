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
import { Schedule } from './Schedule/config'
import { TenantScopedSchedule } from './TenantScopedSchedule/config'
import { SectionTagline } from './SectionTagline/config'
import { HeroWithLocation } from './HeroWithLocation/config'
import { MissionElements } from './MissionElements/config'
import { SimpleAbout } from './SimpleAbout/config'
import {
  Hero,
  About,
  Location,
  Faqs,
  createThreeColumnLayout,
  MarketingHero,
  Features,
  CaseStudies,
  MarketingCta,
  BruHero,
  BruAbout,
  BruSchedule,
  BruLearning,
  BruMeetTheTeam,
  BruTestimonials,
  BruContact,
  BruHeroWaitlist,
  DhHero,
  DhTeam,
  DhTimetable,
  DhTestimonials,
  DhPricing,
  DhContact,
  DhGroups,
  ClHeroScheduleSanctuary,
  CroiLanHeroWithLocation,
  ClFindSanctuary,
  ClMission,
  ClPillars,
  ClSaunaBenefits,
  createTwoColumnLayout,
} from '@repo/website'

import { DhLiveSchedule } from './DhLiveSchedule/config'
import { DhLiveMembership } from './DhLiveMembership/config'

const allBlocks: Block[] = [
  HeroSchedule,
  HeroWithLocation,
  Hero,
  MarketingHero,
  About,
  SimpleAbout,
  Location,
  Schedule,
  TenantScopedSchedule,
  HealthBenefits,
  SectionTagline,
  MissionElements,
  Faqs,
  Features,
  CaseStudies,
  CallToAction,
  MarketingCta,
  Content,
  MediaBlock,
  Archive,
  FormBlock,
  // Bru Grappling (tenant-scoped extras)
  BruHero,
  BruAbout,
  BruSchedule,
  BruLearning,
  BruMeetTheTeam,
  BruTestimonials,
  BruContact,
  BruHeroWaitlist,
  // Dark Horse Strength (tenant-scoped extras)
  DhHero,
  DhTeam,
  DhTimetable,
  DhTestimonials,
  DhPricing,
  DhContact,
  DhGroups,
  DhLiveSchedule,
  DhLiveMembership,
  // Croí Lán Sauna (tenant-scoped extras; croilan.com)
  ClHeroScheduleSanctuary,
  CroiLanHeroWithLocation,
  ClFindSanctuary,
  ClMission,
  ClPillars,
  ClSaunaBenefits,
]

const TwoColumnLayout = createTwoColumnLayout(allBlocks)
const ThreeColumnLayout = createThreeColumnLayout([...allBlocks, TwoColumnLayout])

/**
 * Blocks every tenant can use when building pages (no super-admin enablement).
 * Keep this set small and self-explanatory — new users should assemble pages without training.
 * Brand-specific and advanced blocks stay in `extraBlockSlugs` (Tenants.allowedBlocks).
 */
export const defaultBlockSlugs: string[] = [
  'heroScheduleSanctuary', // Homepage — hero with schedule
  'simpleAbout', // About your business
  'content', // Text section
  'cta', // Call to action button
  'faqs', // Frequently asked questions
  'mediaBlock', // Image or video
  'twoColumnLayout', // Two columns side by side
]

/** Expected Payload picker labels for default blocks (keep in sync with block config `labels.singular`). */
export const defaultBlockDisplayLabels: Record<(typeof defaultBlockSlugs)[number], string> = {
  heroScheduleSanctuary: 'Homepage — hero with schedule',
  simpleAbout: 'About your business',
  content: 'Text section',
  cta: 'Call to action button',
  faqs: 'Frequently asked questions',
  mediaBlock: 'Image or video',
  twoColumnLayout: 'Two columns side by side',
}

/** Map of block slug to block config. Includes threeColumnLayout. */
const blockMap = new Map<string, Block>()
allBlocks.forEach((b) => {
  if (b.slug && !blockMap.has(b.slug)) blockMap.set(b.slug, b)
})
blockMap.set('threeColumnLayout', ThreeColumnLayout)
blockMap.set('twoColumnLayout', TwoColumnLayout)

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
