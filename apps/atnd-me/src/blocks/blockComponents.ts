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
import { ScheduleBlock } from '@/blocks/Schedule/Component'
import { TenantScopedScheduleBlock } from '@/blocks/TenantScopedSchedule/Component'
import { HealthBenefitsBlock } from '@/blocks/HealthBenefits/Component'
import { HeroScheduleBlock } from '@/blocks/HeroSchedule/Component'
import { HeroScheduleSanctuaryBlock } from '@/blocks/HeroScheduleSanctuary/Component'
import { SectionTaglineBlock } from '@/blocks/SectionTagline/Component'
import { ThreeColumnLayoutBlock } from '@repo/website/src/blocks/threeColumnLayout'

// Export the block components registry — heterogeneous block props, so typed loosely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const blockComponents: Record<string, React.ComponentType<any>> = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  mediaBlock: MediaBlock,
  hero: HeroBlock,
  about: AboutBlock,
  location: LocationBlock,
  schedule: ScheduleBlock,
  tenantScopedSchedule: TenantScopedScheduleBlock,
  faqs: FaqsBlock,
  heroSchedule: HeroScheduleBlock,
  heroScheduleSanctuary: HeroScheduleSanctuaryBlock,
  healthBenefits: HealthBenefitsBlock,
  sectionTagline: SectionTaglineBlock,
  threeColumnLayout: ThreeColumnLayoutBlock,
}
