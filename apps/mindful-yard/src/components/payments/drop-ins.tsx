'use client '

import { useAuth } from '@repo/auth-next'

export const DropInPayment = () => {
  useAuth()

  return <div>Drop In Payment</div>
}
