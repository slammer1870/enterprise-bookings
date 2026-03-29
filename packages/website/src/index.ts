// Export collections
export { Posts } from "./collections/posts";

// Export other utilities if needed in the future
export * from "./utils/generate-metadata";
export * from "./utils/generate-post-metadata";
export * from "./utils/sitemap";

// Export access controls
export * from "./access/authenticated";
export * from "./access/admin-or-published";

// Export blocks
export { FormBlock } from "./blocks/form/config";
export { Faqs } from "./blocks/faqs/config";
export { Hero } from "./blocks/hero/config";
export { About } from "./blocks/about/config";
export { Location } from "./blocks/location/config";
export { linkGroup } from "./blocks/linkGroup";
export { ThreeColumnLayoutBlock } from "./blocks/threeColumnLayout";
export { createThreeColumnLayout } from "./blocks/threeColumnLayout";
export { MarketingHero } from "./blocks/marketingHero/config";
export { Features } from "./blocks/features/config";
export { CaseStudies } from "./blocks/caseStudies/config";
export { MarketingCta } from "./blocks/marketingCta/config";
export {
  BruHero,
  BruAbout,
  BruSchedule,
  BruLearning,
  BruMeetTheTeam,
  BruTestimonials,
  BruContact,
  BruHeroWaitlist,
} from "./blocks/bru-grappling";
export {
  DhHero,
  DhTeam,
  DhTimetable,
  DhTestimonials,
  DhPricing,
  DhContact,
  DhGroups,
} from "./blocks/darkhorse-strength";

// Export hooks
export { revalidatePage, revalidateDelete } from "./hooks/revalidate-page"; 