import UserPassRegisterForm from '@repo/auth/src/components/user-pass-register-form'

import { getMeUser } from '@repo/auth/src/utils/get-me-user'

export default async function Register() {
  await getMeUser({ validUserRedirect: '/dashboard' })

  return (
    <div className="flex justify-center items-center h-screen">
      <UserPassRegisterForm />
    </div>
  )
}
