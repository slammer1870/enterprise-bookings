import { cookies, headers } from 'next/headers'
import React from 'react'

import { getPayload } from '@/lib/payload'
import { buildTenantBookingThemeCss } from '@/utilities/buildTenantBookingThemeCss'
import { getTenantWithBranding } from '@/utilities/getTenantContext'

export async function TenantBookingTheme() {
  const cookieStore = await cookies()
  const headersList = await headers()
  const payload = await getPayload()
  const tenant = await getTenantWithBranding(payload, {
    cookies: cookieStore,
    headers: headersList,
  })
  const css = buildTenantBookingThemeCss(tenant?.bookingTheme)

  if (!css) return null

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
