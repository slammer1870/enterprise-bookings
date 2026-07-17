import type React from 'react'

import { MarketingHeroBlock } from '@repo/website/src/blocks/marketingHero'
import { AboutBlock } from '@repo/website/src/blocks/about'
import { FeaturesBlock } from '@repo/website/src/blocks/features'
import { CaseStudiesBlock } from '@repo/website/src/blocks/caseStudies'
import { MarketingCtaBlock } from '@repo/website/src/blocks/marketingCta'
import { FaqsBlock } from '@repo/website/src/blocks/faqs'
import { HeroBlock } from '@repo/website/src/blocks/hero'
import { ContentBlock } from '@/blocks/Content/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'

/**
 * Eager-load light marketing/content blocks (critical for www LCP).
 * Lazy-load heavy tenant packs / schedule / forms so they stay out of marketing JS.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBlockComponent = React.ComponentType<any>

export type BlockLoader = () => Promise<AnyBlockComponent>

const eager =
  (Block: AnyBlockComponent): BlockLoader =>
  async () =>
    Block

export const blockLoaders: Record<string, BlockLoader> = {
  // --- Eager: marketing + common light blocks (no dynamic import tax on SSR) ---
  marketingHero: eager(MarketingHeroBlock),
  about: eager(AboutBlock),
  features: eager(FeaturesBlock),
  caseStudies: eager(CaseStudiesBlock),
  marketingCta: eager(MarketingCtaBlock),
  faqs: eager(FaqsBlock),
  hero: eager(HeroBlock),
  content: eager(ContentBlock),
  cta: eager(CallToActionBlock),
  mediaBlock: eager(MediaBlock),

  // --- Lazy: heavy / tenant-specific ---
  archive: () => import('@/blocks/ArchiveBlock/Component').then((m) => m.ArchiveBlock),
  formBlock: () => import('@/blocks/Form/Component').then((m) => m.FormBlock),
  simpleAbout: () => import('@/blocks/SimpleAbout/Component').then((m) => m.SimpleAboutBlock),
  location: () => import('@repo/website/src/blocks/location').then((m) => m.LocationBlock),
  schedule: () => import('@/blocks/Schedule/Component').then((m) => m.ScheduleBlock),
  tenantScopedSchedule: () =>
    import('@/blocks/TenantScopedSchedule/Component').then((m) => m.TenantScopedScheduleBlock),
  heroScheduleSanctuary: () =>
    import('@/blocks/HeroScheduleSanctuary/Component').then((m) => m.HeroScheduleSanctuaryBlock),
  heroWithLocation: () =>
    import('@/blocks/HeroWithLocation/Component').then((m) => m.HeroWithLocationBlock),
  clHeroLoc: () =>
    import('@/blocks/HeroWithLocation/Component').then((m) => m.HeroWithLocationBlock),
  healthBenefits: () =>
    import('@/blocks/HealthBenefits/Component').then((m) => m.HealthBenefitsBlock),
  sectionTagline: () =>
    import('@/blocks/SectionTagline/Component').then((m) => m.SectionTaglineBlock),
  missionElements: () =>
    import('@/blocks/MissionElements/Component').then((m) => m.MissionElementsBlock),
  threeColumnLayout: () =>
    import('@repo/website/src/blocks/threeColumnLayout').then((m) => m.ThreeColumnLayoutBlock),
  twoColumnLayout: () =>
    import('@repo/website/src/blocks/twoColumnLayout').then((m) => m.TwoColumnLayoutBlock),
  bruHero: () =>
    import('@repo/website/src/blocks/bru-grappling/BruHero').then((m) => m.BruHeroBlock),
  bruAbout: () =>
    import('@repo/website/src/blocks/bru-grappling/BruAbout').then((m) => m.BruAboutBlock),
  bruSchedule: () =>
    import('@repo/website/src/blocks/bru-grappling/BruSchedule').then((m) => m.BruScheduleBlock),
  bruLearning: () =>
    import('@repo/website/src/blocks/bru-grappling/BruLearning').then((m) => m.BruLearningBlock),
  bruMeetTheTeam: () =>
    import('@repo/website/src/blocks/bru-grappling/BruMeetTheTeam').then((m) => m.BruMeetTheTeamBlock),
  bruTestimonials: () =>
    import('@repo/website/src/blocks/bru-grappling/BruTestimonials').then(
      (m) => m.BruTestimonialsBlock,
    ),
  bruContact: () =>
    import('@repo/website/src/blocks/bru-grappling/BruContact').then((m) => m.BruContactBlock),
  bruHeroWaitlist: () =>
    import('@repo/website/src/blocks/bru-grappling/BruHeroWaitlist').then(
      (m) => m.BruHeroWaitlistBlock,
    ),
  dhHero: () =>
    import('@repo/website/src/blocks/darkhorse-strength/DhHero').then((m) => m.DhHeroBlock),
  dhTeam: () =>
    import('@repo/website/src/blocks/darkhorse-strength/DhTeam').then((m) => m.DhTeamBlock),
  dhTimetable: () =>
    import('@repo/website/src/blocks/darkhorse-strength/DhTimetable').then((m) => m.DhTimetableBlock),
  dhTestimonials: () =>
    import('@repo/website/src/blocks/darkhorse-strength/DhTestimonials').then(
      (m) => m.DhTestimonialsBlock,
    ),
  dhPricing: () =>
    import('@repo/website/src/blocks/darkhorse-strength/DhPricing').then((m) => m.DhPricingBlock),
  dhContact: () =>
    import('@repo/website/src/blocks/darkhorse-strength/DhContact').then((m) => m.DhContactBlock),
  dhGroups: () =>
    import('@repo/website/src/blocks/darkhorse-strength/DhGroups').then((m) => m.DhGroupsBlock),
  dhLiveSchedule: () =>
    import('@/blocks/DhLiveSchedule/Component').then((m) => m.DhLiveScheduleBlock),
  dhLiveMembership: () =>
    import('@/blocks/DhLiveMembership/Component').then((m) => m.DhLiveMembershipBlock),
  clFindSanctuary: () =>
    import('@repo/website/src/blocks/croi-lan-sauna/ClFindSanctuary').then(
      (m) => m.ClFindSanctuaryBlock,
    ),
  clMission: () =>
    import('@repo/website/src/blocks/croi-lan-sauna/ClMission').then((m) => m.ClMissionBlock),
  clPillars: () =>
    import('@repo/website/src/blocks/croi-lan-sauna/ClPillars').then((m) => m.ClPillarsBlock),
  clSaunaBenefits: () =>
    import('@repo/website/src/blocks/croi-lan-sauna/ClSaunaBenefits').then(
      (m) => m.ClSaunaBenefitsBlock,
    ),
  hwHeroServices: () =>
    import('@repo/website/src/blocks/holohan-wellness/HwHeroServices').then(
      (m) => m.HwHeroServicesBlock,
    ),
}
