import { ForgotPasswordForm } from '@repo/auth/src/components/forgot-password-form'

import { getMeUser } from '@repo/auth/src/utils/get-me-user'

export default async function ForgotPassword() {
  await getMeUser({ validUserRedirect: '/dashboard' })

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <ForgotPasswordForm />
    </div>
  )
}
