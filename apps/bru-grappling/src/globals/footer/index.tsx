import { FooterGlobal } from './client'
import { getCachedGlobal } from '@/utils/get-globals'
import React from 'react'

// Type definition for footer data until it's added to payload-types
interface FooterType {
  companyName?: string
  email?: string
  locationUrl?: string
  instagramUrl?: string
}

export async function Footer() {
  // Since footer might not be configured in the CMS yet, we'll make it optional
  let footerData: FooterType | null = null

  try {
    footerData = (await getCachedGlobal('footer', 1)()) as FooterType
  } catch (error) {
    // Footer global might not exist yet, that's okay
    console.log('Footer global not found, using default footer')
  }

  return <FooterGlobal data={footerData || undefined} />
}
