import { ResetPasswordForm } from '@repo/auth/src/components/reset-password-form'

import { getMeUser } from '@repo/auth/src/utils/get-me-user'

export default async function ForgotPassword() {
  await getMeUser({ validUserRedirect: '/dashboard' })

  return (
    <div className="flex justify-center items-center h-screen">
      <ResetPasswordForm />
    </div>
  )
}
