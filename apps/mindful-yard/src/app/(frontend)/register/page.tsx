import { getMeUser } from '@repo/auth/src/utils/get-me-user'

import { RegisterLoginTabs } from '@repo/auth/src/components/register-login-tabs'

export default async function Register() {
  console.log('process.env.SERVER_URL', process.env.SERVER_URL)

  const user = await fetch(`${process.env.SERVER_URL}/api/users/me`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <dialog className="relative flex h-auto max-h-[600px] w-4/5 max-w-[400px] rounded-lg border-0 bg-white font-medium">
        <RegisterLoginTabs value="register" />
      </dialog>
    </div>
  )
}
