import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanView } from '../../../../membership-next/src/components/plan-view'
import type { Plan, Subscription } from '@repo/shared-types'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/bookings/123'),
  useParams: vi.fn(() => ({ id: '123' })),
}))

const createPlan = (overrides: Partial<Plan> = {}): Plan =>
  ({
    id: 1,
    name: 'Family Membership',
    status: 'active',
    features: [],
    priceJSON: null,
    ...overrides,
  }) as unknown as Plan

const createSubscription = (plan: Plan, overrides: Partial<Subscription> = {}): Subscription =>
  ({
    id: 10,
    status: 'past_due',
    plan,
    ...overrides,
  }) as unknown as Subscription

describe('PlanView upgrade flow', () => {
  it('keeps the upgrade CTA enabled for a past-due subscription when upgrading by plan id', async () => {
    const currentPlan = createPlan({ id: 100, name: 'Single Membership' })
    const upgradePlan = createPlan({ id: 200, name: 'Family Membership' })
    const onCreateCustomerUpgradePortal = vi.fn().mockResolvedValue(undefined)

    render(
      <PlanView
        allowedPlans={[upgradePlan]}
        subscription={createSubscription(currentPlan)}
        lessonDate={new Date('2026-03-21T10:00:00.000Z')}
        subscriptionLimitReached={false}
        canUseSubscriptionForQuantity={false}
        subscriptionAllowsMultiplePerLesson={false}
        needsCustomerPortal
        onCreateCheckoutSession={vi.fn().mockResolvedValue(undefined)}
        onCreateCustomerPortal={vi.fn().mockResolvedValue(undefined)}
        onCreateCustomerUpgradePortal={onCreateCustomerUpgradePortal}
      />
    )

    expect(
      screen.getByText(/you do not have a plan that allows you to book into this lesson/i)
    ).toBeInTheDocument()

    const upgradeButton = screen.getByRole('button', { name: /upgrade subscription/i })
    expect(upgradeButton).toBeEnabled()

    await userEvent.click(upgradeButton)

    expect(onCreateCustomerUpgradePortal).toHaveBeenCalledWith(200)
  })

  it('keeps the limit-reached upgrade CTA enabled when upgrade options are available', async () => {
    const currentPlan = createPlan({ id: 100, name: 'Single Membership' })
    const upgradePlan = createPlan({ id: 300, name: 'Family Membership' })
    const onCreateCustomerUpgradePortal = vi.fn().mockResolvedValue(undefined)

    render(
      <PlanView
        allowedPlans={[currentPlan, upgradePlan]}
        subscription={createSubscription(currentPlan, { status: 'active' })}
        lessonDate={new Date('2026-03-21T10:00:00.000Z')}
        subscriptionLimitReached
        canUseSubscriptionForQuantity={false}
        remainingSessions={0}
        selectedQuantity={2}
        subscriptionAllowsMultiplePerLesson
        upgradeOptions={[
          {
            plan: upgradePlan,
            maxAdditionalSessions: 4,
          },
        ]}
        onCreateCheckoutSession={vi.fn().mockResolvedValue(undefined)}
        onCreateCustomerPortal={vi.fn().mockResolvedValue(undefined)}
        onCreateCustomerUpgradePortal={onCreateCustomerUpgradePortal}
      />
    )

    expect(
      screen.getByText(/you have reached the limit of your subscription/i)
    ).toBeInTheDocument()

    const upgradeButton = screen.getByRole('button', { name: /^upgrade$/i })
    expect(upgradeButton).toBeEnabled()

    await userEvent.click(upgradeButton)

    expect(onCreateCustomerUpgradePortal).toHaveBeenCalledWith(300)
  })
})
