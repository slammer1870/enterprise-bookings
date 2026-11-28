import { describe, expect, it } from 'vitest'

import { buildOnlineRetentionFeatures } from '@/lib/analytics/retentionFeatures'
import {
  ONLINE_RETENTION_CATEGORICAL_FEATURES,
  ONLINE_RETENTION_NUMERIC_FEATURES,
  retentionModelMetadata,
  scoreRetentionModel,
} from '@/lib/analytics/retentionModel'

describe('online retention model', () => {
  it('pins the runtime feature and timezone contract used by the exported model', () => {
    expect(ONLINE_RETENTION_NUMERIC_FEATURES).toHaveLength(15)
    expect(ONLINE_RETENTION_CATEGORICAL_FEATURES).toEqual(['latest_payment_method'])
    expect(retentionModelMetadata.featureCount).toBe(16)
    expect(retentionModelMetadata.trainingTimeZone).toBe('Europe/Dublin')
  })

  it('matches the exported sklearn parity example', () => {
    const result = scoreRetentionModel({
      bookings_3d: 0,
      bookings_14d: 0,
      bookings_28d: 0,
      bookings_lifetime: 3,
      active_booking_days_3d: 0,
      booking_rate_lifetime: 0.018404907975460124,
      booking_velocity_14d_vs_lifetime: -0.018404907975460124,
      days_since_last_booking: 155,
      upcoming_classes_7d: 0,
      transactions_3d: 0,
      transactions_7d: 0,
      payment_methods_28d: 0,
      subscriptions_created_14d: 0,
      subscriptions_created_28d: 0,
      days_since_signup: 167,
      latest_payment_method: 'subscription',
    })

    expect(result.bookingPropensity).toBeCloseTo(0.3120100010636299, 12)
    expect(result.outreachPriority).toBe(69)
    expect(result.belowDecisionThreshold).toBe(true)
    expect(result.modelVersion).toBe('retention-next-7d-online-safe-v1')
  })

  it('builds windows using only information available on the prediction date', () => {
    const features = buildOnlineRetentionFeatures({
      predictionYmd: '2026-10-10',
      signupYmd: '2026-09-01',
      bookings: [
        { createdYmd: '2026-10-10', classYmd: '2026-10-12', status: 'confirmed' },
        { createdYmd: '2026-10-08', classYmd: '2026-10-16', status: 'confirmed' },
        { createdYmd: '2026-09-20', classYmd: '2026-10-11', status: 'cancelled' },
        { createdYmd: '2026-08-01', classYmd: '2026-08-03', status: 'confirmed' },
        { createdYmd: '2026-10-11', classYmd: '2026-10-13', status: 'confirmed' },
        // These statuses do not exist in the notebook's training event set and must not
        // affect runtime features, even when they fall inside the rolling windows.
        { createdYmd: '2026-10-09', classYmd: '2026-10-11', status: 'pending' },
        { createdYmd: '2026-10-07', classYmd: '2026-10-12', status: 'waiting' },
      ],
      transactions: [
        { createdYmd: '2026-10-10', paymentMethod: 'subscription' },
        { createdYmd: '2026-10-05', paymentMethod: 'class_pass' },
        { createdYmd: '2026-08-01', paymentMethod: 'stripe' },
      ],
      subscriptions: [{ createdYmd: '2026-09-25' }, { createdYmd: '2026-10-11' }],
    })

    expect(features.bookings_3d).toBe(2)
    expect(features.bookings_14d).toBe(2)
    expect(features.bookings_28d).toBe(3)
    expect(features.bookings_lifetime).toBe(4)
    expect(features.active_booking_days_3d).toBe(2)
    expect(features.days_since_last_booking).toBe(0)
    expect(features.upcoming_classes_7d).toBe(2)
    expect(features.transactions_3d).toBe(1)
    expect(features.transactions_7d).toBe(2)
    expect(features.payment_methods_28d).toBe(2)
    expect(features.subscriptions_created_14d).toBe(0)
    expect(features.subscriptions_created_28d).toBe(1)
    expect(features.days_since_signup).toBe(39)
    expect(features.latest_payment_method).toBe('subscription')
  })
})
