import { getMeUser } from '@repo/auth'

import { RegisterLoginTabs } from '@repo/auth'
import { Suspense } from 'react'

export default async function Register() {
  const user = await getMeUser({ validUserRedirect: '/' })

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <dialog className="relative flex h-auto max-h-[600px] w-4/5 max-w-[400px] rounded-lg border-0 bg-white font-medium">
        <Suspense fallback={<div>Loading...</div>}>
          <RegisterLoginTabs value="register" />
        </Suspense>
      </dialog>
    </div>
  )
}
