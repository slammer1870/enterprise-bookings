import type { Page } from '@playwright/test'

type PlanDoc = {
  id: number | string
  name?: string | null
  priceJSON?: string | null
  status?: string | null
}

export async function ensureAtLeastOneActivePlanWithStripePrice(page: Page): Promise<{
  planId: number
  planName: string
  stripePriceId: string
}> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const request: any = (page.context() as any).request

  const cookieHeader = async () => {
    const cookies: Array<{ name: string; value: string }> = await (page.context() as any).cookies()
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  }

  const ensurePlanHasStripePriceId = async (plan: PlanDoc) => {
    const planId = plan?.id
    if (!planId) throw new Error(`Plan is missing id: ${JSON.stringify(plan)}`)

    // If it's already set, keep it.
    try {
      const parsed = plan?.priceJSON ? JSON.parse(plan.priceJSON) : null
      if (parsed?.id && typeof parsed.id === 'string') return parsed.id as string
    } catch {
      // We'll overwrite.
    }

    const fakeStripePriceId = `price_e2e_${Date.now()}`

    const patchRes = await request.patch(`${baseUrl}/api/plans/${planId}`, {
      headers: { Cookie: await cookieHeader(), 'Content-Type': 'application/json' },
      data: {
        status: 'active',
        // memberships `PlanDetail` parses `priceJSON` and uses `.id` as the Stripe priceId.
        priceJSON: JSON.stringify({ id: fakeStripePriceId, unit_amount: 1500_00, type: 'recurring' }),
        // Avoid any Stripe sync hooks from running during tests.
        skipSync: true,
      },
    })
    if (!patchRes.ok()) {
      const txt = await patchRes.text().catch(() => '')
      throw new Error(`Failed to patch plan "${plan?.name ?? planId}" priceJSON: ${patchRes.status()} ${txt}`)
    }

    return fakeStripePriceId
  }

  // API-first: avoid flakiness reading admin table text; also ensures seeded plans get patched.
  const existingRes = await request.get(`${baseUrl}/api/plans?limit=1&sort=-createdAt`, {
    headers: { Cookie: await cookieHeader() },
  })
  if (existingRes.ok()) {
    const json: any = await existingRes.json().catch(() => null)
    const existing: PlanDoc | null = json?.docs?.[0] ?? null
    if (existing?.id != null) {
      const stripePriceId = await ensurePlanHasStripePriceId(existing)
      return {
        planId: Number(existing.id),
        planName: (existing?.name ?? 'Plan').toString(),
        stripePriceId,
      }
    }
  }

  // No plan exists yet (or API fetch failed). Create via API so we can set hidden fields deterministically.
  const planName = `E2E Plan ${Date.now()}`
  const stripePriceId = `price_e2e_${Date.now()}`
  const createRes = await request.post(`${baseUrl}/api/plans`, {
    headers: { Cookie: await cookieHeader(), 'Content-Type': 'application/json' },
    data: {
      name: planName,
      status: 'active',
      priceInformation: { price: 1500, interval: 'month', intervalCount: 1 },
      skipSync: true,
      priceJSON: JSON.stringify({ id: stripePriceId, unit_amount: 1500_00, type: 'recurring' }),
    },
  })
  if (!createRes.ok()) {
    const txt = await createRes.text().catch(() => '')
    throw new Error(`Failed to create plan via API: ${createRes.status()} ${txt}`)
  }
  const created: any = await createRes.json().catch(() => null)
  const createdId = created?.doc?.id ?? created?.id
  if (createdId == null) throw new Error(`Unexpected create plan response: ${JSON.stringify(created)}`)

  return {
    planId: Number(createdId),
    planName,
    stripePriceId,
  }
}

export async function setClassOptionAllowedPlans(
  page: Page,
  options: { classOptionId: number; planIds: number[] },
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const request: any = (page.context() as any).request

  const cookieHeader = async () => {
    const cookies: Array<{ name: string; value: string }> = await (page.context() as any).cookies()
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  }

  const res = await request.patch(`${baseUrl}/api/class-options/${options.classOptionId}`, {
    headers: { Cookie: await cookieHeader(), 'Content-Type': 'application/json' },
    data: {
      paymentMethods: {
        allowedPlans: options.planIds,
      },
    },
  })

  if (!res.ok()) {
    const txt = await res.text().catch(() => '')
    throw new Error(
      `Failed to set paymentMethods.allowedPlans on class-options/${options.classOptionId}: ${res.status()} ${txt}`,
    )
  }
}




