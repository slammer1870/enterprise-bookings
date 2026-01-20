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
import { HeroScheduleBlock } from '@/blocks/HeroSchedule/Component'
import { ThreeColumnLayoutBlock } from '@repo/website/src/blocks/threeColumnLayout'

// Export the block components registry
// This maps block slugs (from block configs) to their React components
export const blockComponents: Record<string, React.ComponentType<any> | ((props: any) => any)> = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  mediaBlock: MediaBlock,
  hero: HeroBlock,
  about: AboutBlock,
  location: LocationBlock,
  schedule: ScheduleBlock,
  faqs: FaqsBlock,
  heroSchedule: HeroScheduleBlock,
  threeColumnLayout: ThreeColumnLayoutBlock,
}
