'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function handlePlanPurchase(planId?: string, metadata?: { [key: string]: string | undefined }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  if (!token) {
    throw new Error('Authentication required')
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/stripe/create-checkout-session`,
    {
      method: 'POST',
      body: JSON.stringify({ price: planId, quantity: 1, metadata }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${token}`,
      },
    },
  )

  const data = await response.json()

  if (data.url) {
    redirect(data.url)
  }
}

export async function handleSubscriptionManagement() {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  if (!token) {
    throw new Error('Authentication required')
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/stripe/create-customer-portal`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${token}`,
      },
    },
  )
  const data = await response.json()

  if (data.url) {
    redirect(data.url)
  }
}

