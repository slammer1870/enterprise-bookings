import { getMeUser } from '@repo/auth/src/utils/get-me-user'

import { RegisterLoginTabs } from '@repo/auth/src/components/register-login-tabs'

export default async function Login() {
  const user = await getMeUser({ validUserRedirect: '/dashboard' })
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <dialog className="relative flex h-auto max-h-[600px] w-4/5 max-w-[400px] rounded-lg border-0 bg-white font-medium">
        <RegisterLoginTabs value="login" />
      </dialog>
    </div>
  )
}
