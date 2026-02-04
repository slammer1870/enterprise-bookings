import { HeaderClient } from './Component.client'
import { cookies } from 'next/headers'
import React from 'react'
import { getPayload } from '@/lib/payload'
import { getNavbarForRequest } from '@/utilities/getNavbarFooterForRequest'

export async function Header() {
  const cookieStore = await cookies()
  const payload = await getPayload()
  const headerData = await getNavbarForRequest(payload, { cookies: cookieStore })

  return <HeaderClient data={headerData} />
}
