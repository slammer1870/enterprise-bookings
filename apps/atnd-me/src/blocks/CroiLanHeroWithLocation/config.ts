import type { Block } from 'payload'
import { HeroWithLocation } from '@/blocks/HeroWithLocation/config'

export const CroiLanHeroWithLocation: Block = {
  ...HeroWithLocation,
  slug: 'croiLanHeroWithLocation',
  interfaceName: 'CroiLanHeroWithLocationBlock',
  labels: {
    singular: 'Croí Lán – Hero with Location',
    plural: 'Croí Lán – Heroes with Location',
  },
}

