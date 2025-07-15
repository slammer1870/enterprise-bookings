import { ResetPasswordForm } from '@repo/auth'

import { getMeUser } from '@repo/auth'

export default async function ForgotPassword() {
  await getMeUser({ validUserRedirect: '/dashboard' })

  return (
    <div className="flex justify-center items-center h-screen pt-20">
      <ResetPasswordForm />
    </div>
  )
}
