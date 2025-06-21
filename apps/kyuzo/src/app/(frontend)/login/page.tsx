import UserPassLoginForm from '@repo/auth/src/components/user-pass-login'

import { getMeUser } from '@repo/auth/src/utils/get-me-user'

export default async function Login() {
  await getMeUser({ validUserRedirect: '/dashboard' })

  return (
    <div className="flex justify-center items-center h-screen pt-20">
      <UserPassLoginForm />
    </div>
  )
}
