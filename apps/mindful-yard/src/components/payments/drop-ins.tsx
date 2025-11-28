'use client '

import { User } from '@repo/shared-types'
import { useAuth } from '@repo/auth-next'

import { useState } from 'react'

export const DropInPayment = () => {
  const { user } = useAuth()

  return <div>Drop In Payment</div>
}
