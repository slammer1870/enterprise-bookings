import { UserPassRegisterForm } from '@repo/auth-next'

import { getMeUser } from '@repo/auth-next'

export default async function Register() {
  await getMeUser({ validUserRedirect: '/dashboard' })

  return (
    <div className="flex justify-center items-center h-screen pt-20">
      <UserPassRegisterForm />
    </div>
  )
}
