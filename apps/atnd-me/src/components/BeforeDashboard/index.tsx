'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'
import { getStripeConnectNoticeFromSearch } from '@/components/admin/stripeConnectNotice'

import { SeedButton } from './SeedButton'
import './index.scss'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC = () => {
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
        <li>
          {'Modify your collections and add more fields as needed.'}
        </li>
        <li>
          Commit and push your changes to the repository to trigger a redeployment of your project.
        </li>
      </ul>
      {'Pro Tip: This block is a custom component — you can remove it at any time by updating your '}
      <strong>payload.config</strong>.
    </div>
  )
}

export default BeforeDashboard
