import { ResetPasswordForm } from '@repo/auth-next'

import { getMeUser } from '@repo/auth-next'

export default async function ForgotPassword() {
  await getMeUser({ validUserRedirect: '/dashboard' })

  return (
    <div className="flex justify-center items-center h-screen pt-20">
      <ResetPasswordForm />
    </div>
  )
}
