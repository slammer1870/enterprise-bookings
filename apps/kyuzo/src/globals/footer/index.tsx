import { FooterGlobal } from './client'
import { getCachedGlobal } from '@/utils/get-globals'
import React from 'react'

import type { Footer } from '@/payload-types'

export async function Footer() {
  const footerData = (await getCachedGlobal('footer', 1)()) as Footer

  return <FooterGlobal data={footerData} />
}
