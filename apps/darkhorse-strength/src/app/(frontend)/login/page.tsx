import { UserPassLoginForm } from '@repo/auth'

import { getMeUser } from '@repo/auth'

export default async function Login() {
  await getMeUser({ validUserRedirect: '/dashboard' })

  return (
    <div className="flex justify-center items-center h-screen pt-20">
      <UserPassLoginForm />
    </div>
  )
}
