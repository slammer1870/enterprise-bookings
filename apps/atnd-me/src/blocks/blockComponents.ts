import React from 'react'
import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock } from '@/blocks/Content/Component'
import { FormBlock } from '@/blocks/Form/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { HeroBlock } from '@repo/website/src/blocks/hero'
import { AboutBlock } from '@repo/website/src/blocks/about'
import { LocationBlock } from '@repo/website/src/blocks/location'
import { FaqsBlock } from '@repo/website/src/blocks/faqs'
import { MarketingHeroBlock } from '@repo/website/src/blocks/marketingHero'
import { FeaturesBlock } from '@repo/website/src/blocks/features'
import { CaseStudiesBlock } from '@repo/website/src/blocks/caseStudies'
import { MarketingCtaBlock } from '@repo/website/src/blocks/marketingCta'
import { ScheduleBlock } from '@/blocks/Schedule/Component'
import { TenantScopedScheduleBlock } from '@/blocks/TenantScopedSchedule/Component'
import { HealthBenefitsBlock } from '@/blocks/HealthBenefits/Component'
import { HeroScheduleBlock } from '@/blocks/HeroSchedule/Component'
import { HeroScheduleSanctuaryBlock } from '@/blocks/HeroScheduleSanctuary/Component'
import { SectionTaglineBlock } from '@/blocks/SectionTagline/Component'
import { HeroWithLocationBlock } from '@/blocks/HeroWithLocation/Component'
import { MissionElementsBlock } from '@/blocks/MissionElements/Component'
import { ThreeColumnLayoutBlock } from '@repo/website/src/blocks/threeColumnLayout'
import { BruHeroBlock } from '@repo/website/src/blocks/bru-grappling/BruHero'
import { BruAboutBlock } from '@repo/website/src/blocks/bru-grappling/BruAbout'
import { BruScheduleBlock } from '@repo/website/src/blocks/bru-grappling/BruSchedule'
import { BruLearningBlock } from '@repo/website/src/blocks/bru-grappling/BruLearning'
import { BruMeetTheTeamBlock } from '@repo/website/src/blocks/bru-grappling/BruMeetTheTeam'
import { BruTestimonialsBlock } from '@repo/website/src/blocks/bru-grappling/BruTestimonials'
import { BruContactBlock } from '@repo/website/src/blocks/bru-grappling/BruContact'
import { BruHeroWaitlistBlock } from '@repo/website/src/blocks/bru-grappling/BruHeroWaitlist'

// Export the block components registry — heterogeneous block props, so typed loosely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const blockComponents: Record<string, React.ComponentType<any>> = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  mediaBlock: MediaBlock,
  hero: HeroBlock,
  marketingHero: MarketingHeroBlock,
  about: AboutBlock,
  location: LocationBlock,
  schedule: ScheduleBlock,
  tenantScopedSchedule: TenantScopedScheduleBlock,
  faqs: FaqsBlock,
  features: FeaturesBlock,
  caseStudies: CaseStudiesBlock,
  marketingCta: MarketingCtaBlock,
  heroSchedule: HeroScheduleBlock,
  heroScheduleSanctuary: HeroScheduleSanctuaryBlock,
  heroWithLocation: HeroWithLocationBlock,
  clHeroLoc: HeroWithLocationBlock,
  healthBenefits: HealthBenefitsBlock,
  sectionTagline: SectionTaglineBlock,
  missionElements: MissionElementsBlock,
  threeColumnLayout: ThreeColumnLayoutBlock,
  bruHero: BruHeroBlock,
  bruAbout: BruAboutBlock,
  bruSchedule: BruScheduleBlock,
  bruLearning: BruLearningBlock,
  bruMeetTheTeam: BruMeetTheTeamBlock,
  bruTestimonials: BruTestimonialsBlock,
  bruContact: BruContactBlock,
  bruHeroWaitlist: BruHeroWaitlistBlock,
}
