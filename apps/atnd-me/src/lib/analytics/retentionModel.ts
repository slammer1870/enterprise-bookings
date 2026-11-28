import modelArtifact from './models/retention-next-7d-online-safe-v1.json'

export type OnlineRetentionFeatures = {
  bookings_3d: number
  bookings_14d: number
  bookings_28d: number
  bookings_lifetime: number
  active_booking_days_3d: number
  booking_rate_lifetime: number
  booking_velocity_14d_vs_lifetime: number
  days_since_last_booking: number | null
  upcoming_classes_7d: number
  transactions_3d: number
  transactions_7d: number
  payment_methods_28d: number
  subscriptions_created_14d: number
  subscriptions_created_28d: number
  days_since_signup: number | null
  latest_payment_method: string | null
}

type NumericFeature = Exclude<keyof OnlineRetentionFeatures, 'latest_payment_method'>
type CategoricalFeature = Extract<keyof OnlineRetentionFeatures, 'latest_payment_method'>

// Explicit runtime contract for the exported sklearn pipeline. Keep this separate from the
// artifact so a retrain cannot silently add, remove, or reorder a feature at inference time.
export const ONLINE_RETENTION_NUMERIC_FEATURES = [
  'bookings_3d',
  'bookings_14d',
  'bookings_28d',
  'bookings_lifetime',
  'active_booking_days_3d',
  'booking_rate_lifetime',
  'booking_velocity_14d_vs_lifetime',
  'days_since_last_booking',
  'upcoming_classes_7d',
  'transactions_3d',
  'transactions_7d',
  'payment_methods_28d',
  'subscriptions_created_14d',
  'subscriptions_created_28d',
  'days_since_signup',
] as const satisfies readonly NumericFeature[]

export const ONLINE_RETENTION_CATEGORICAL_FEATURES = [
  'latest_payment_method',
] as const satisfies readonly CategoricalFeature[]

export type RetentionModelScore = {
  /** Relative model score only: class weighting means this is not a calibrated probability. */
  bookingPropensity: number
  outreachPriority: number
  belowDecisionThreshold: boolean
  modelVersion: string
}

function sigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value))
  const exp = Math.exp(value)
  return exp / (1 + exp)
}

function assertArtifactFeatureContract(): void {
  const numericMatches =
    JSON.stringify(modelArtifact.numericFeatures) ===
    JSON.stringify(ONLINE_RETENTION_NUMERIC_FEATURES)
  const categoricalMatches =
    JSON.stringify(modelArtifact.categoricalFeatures) ===
    JSON.stringify(ONLINE_RETENTION_CATEGORICAL_FEATURES)

  if (!numericMatches || !categoricalMatches) {
    throw new Error(
      `Retention model ${modelArtifact.modelVersion} does not match the runtime feature contract`,
    )
  }
}

/**
 * Reproduces the notebook's median imputation, MinMax scaling, one-hot encoding,
 * and logistic-regression inference without requiring Python at runtime.
 */
export function scoreRetentionModel(features: OnlineRetentionFeatures): RetentionModelScore {
  assertArtifactFeatureContract()
  const transformed: number[] = []

  for (const featureName of modelArtifact.numericFeatures as NumericFeature[]) {
    const raw = features[featureName]
    const median = modelArtifact.numericImputerMedians[featureName]
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : median
    const min = modelArtifact.numericDataMin[featureName]
    const max = modelArtifact.numericDataMax[featureName]
    transformed.push(max === min ? 0 : (value - min) / (max - min))
  }

  for (const featureName of modelArtifact.categoricalFeatures as CategoricalFeature[]) {
    const raw = features[featureName]
    const value =
      typeof raw === 'string' && raw.length > 0
        ? raw
        : modelArtifact.categoricalImputerValues[featureName]
    for (const category of modelArtifact.categoricalValues[featureName]) {
      transformed.push(value === category ? 1 : 0)
    }
  }

  if (transformed.length !== modelArtifact.coefficients.length) {
    throw new Error(
      `Retention model feature mismatch: ${transformed.length} values for ${modelArtifact.coefficients.length} coefficients`,
    )
  }

  let logit = modelArtifact.intercept
  for (let index = 0; index < transformed.length; index += 1) {
    logit += transformed[index]! * modelArtifact.coefficients[index]!
  }

  const bookingPropensity = sigmoid(logit)
  return {
    bookingPropensity,
    outreachPriority: Math.round((1 - bookingPropensity) * 100),
    belowDecisionThreshold: bookingPropensity < modelArtifact.decisionThreshold,
    modelVersion: modelArtifact.modelVersion,
  }
}

export const retentionModelMetadata = {
  modelVersion: modelArtifact.modelVersion,
  decisionThreshold: modelArtifact.decisionThreshold,
  target: modelArtifact.target,
  trainingDataThrough: modelArtifact.trainingDataThrough,
  trainingTimeZone: modelArtifact.trainingTimeZone,
  featureCount: modelArtifact.numericFeatures.length + modelArtifact.categoricalFeatures.length,
} as const
