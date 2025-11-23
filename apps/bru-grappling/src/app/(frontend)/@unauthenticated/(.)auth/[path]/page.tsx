import { AuthView } from '@daveyplate/better-auth-ui'
import { Modal } from '../../modal'
import { AuthTabs } from '@/components/auth/auth-tabs'

import { authViewPaths } from '@daveyplate/better-auth-ui/server'

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthModalPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params

  // For sign-in and sign-up, show tabs. For other flows, show single view
  const showTabs = path === 'sign-in' || path === 'sign-up'

  return (
    <Modal>
      {showTabs ? (
        <AuthTabs defaultView={path === 'sign-up' ? 'sign-up' : 'sign-in'} />
      ) : (
        <AuthView path={path} redirectTo="/dashboard" />
      )}
    </Modal>
  )
}
