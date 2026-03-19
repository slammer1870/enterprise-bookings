import type { Block } from 'payload'
import { HeroWithLocation } from '@/blocks/HeroWithLocation/config'

export const CroiLanHeroWithLocation: Block = {
  ...HeroWithLocation,
  // Keep the admin label descriptive, but keep the slug short to avoid exceeding
  // Postgres 63-char identifier limits when Drizzle generates enums for nested fields (e.g. links).
  slug: 'clHeroLoc',
  interfaceName: 'CroiLanHeroWithLocationBlock',
  labels: {
    singular: 'Croí Lán – Hero with Location',
    plural: 'Croí Lán – Heroes with Location',
  },
}

