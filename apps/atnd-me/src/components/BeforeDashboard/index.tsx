'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import { useAuth } from '@payloadcms/ui'
import React from 'react'
import { getStripeConnectNoticeFromSearch } from '@/components/admin/stripeConnectNotice'
import { isAdmin } from '@/utilities/check-admin-role'

import { SeedButton } from './SeedButton'
import { OnboardingChecklist } from './OnboardingChecklist'
import './index.scss'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC = () => {
  const { user } = useAuth()
  const showSeed = Boolean(user && isAdmin(user))

  const stripeNotice =
    typeof window !== 'undefined'
      ? getStripeConnectNoticeFromSearch(window.location.search)
      : null

  return (
    <div className={baseClass}>
      {stripeNotice ? (
        <Banner
          className={`${baseClass}__banner`}
          type={stripeNotice.tone === 'error' ? 'error' : 'success'}
        >
          <h4>{stripeNotice.message}</h4>
        </Banner>
      ) : null}

      <OnboardingChecklist />

      {showSeed ? (
        <>
          <Banner className={`${baseClass}__banner`} type="success">
            <h4>Welcome to your dashboard!</h4>
          </Banner>
          Here&apos;s what to do next:
          <ul className={`${baseClass}__instructions`}>
            <li>
              <SeedButton />
              {' with a few pages, posts, and projects to jump-start your new site, then '}
              <a href="/" target="_blank">
                visit your website
              </a>
              {' to see the results.'}
            </li>
          </ul>
        </>
      ) : null}
    </div>
  )
}

export default BeforeDashboard
