'use client'

import { useRouter } from 'next/navigation'

import { useAuth } from '@repo/auth-next'

export const LogoutButton = () => {
  const router = useRouter()

  const { logout } = useAuth()

  const handleLogout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await logout()
    router.refresh()
  }

  return (
    <form onSubmit={handleLogout}>
      <button type="submit" className="text-sm w-full text-left p-2 hover:bg-gray-100">
        Log Out
      </button>
    </form>
  )
}
