import type { OnlineRetentionFeatures } from './retentionModel'

export type RetentionBookingEvent = {
  createdYmd: string | null
  classYmd: string | null
  status: string | null
}

export type RetentionTransactionEvent = {
  createdYmd: string | null
  paymentMethod: string | null
}

export type RetentionSubscriptionEvent = {
  createdYmd: string | null
}

type BuildRetentionFeaturesInput = {
  predictionYmd: string
  signupYmd: string | null
  bookings: RetentionBookingEvent[]
  transactions: RetentionTransactionEvent[]
  subscriptions: RetentionSubscriptionEvent[]
}

function ymdDayNumber(value: string): number | null {
  const parts = value.split('-').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null
  return Math.floor(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!) / 86_400_000)
}

function daysBeforeOrOn(eventYmd: string | null, predictionDay: number): number | null {
  if (!eventYmd) return null
  const eventDay = ymdDayNumber(eventYmd)
  if (eventDay == null) return null
  const difference = predictionDay - eventDay
  return difference >= 0 ? difference : null
}

function countWithinWindow(
  values: Array<string | null>,
  predictionDay: number,
  windowDays: number,
): number {
  return values.reduce((count, value) => {
    const age = daysBeforeOrOn(value, predictionDay)
    return count + (age != null && age < windowDays ? 1 : 0)
  }, 0)
}

function isTrainingBookingStatus(status: string | null): boolean {
  const normalized = status?.trim().toLowerCase()
  return normalized === 'confirmed' || normalized === 'cancelled'
}

export function buildOnlineRetentionFeatures(
  input: BuildRetentionFeaturesInput,
): OnlineRetentionFeatures {
  const predictionDay = ymdDayNumber(input.predictionYmd)
  if (predictionDay == null) throw new Error(`Invalid prediction date: ${input.predictionYmd}`)

  // Keep online inference aligned with the notebook's `booking_events` CTE. Pending and
  // waiting rows were excluded from training, so counting them here would cause skew.
  const eligibleBookings = input.bookings.filter(
    (booking) =>
      isTrainingBookingStatus(booking.status) &&
      daysBeforeOrOn(booking.createdYmd, predictionDay) != null,
  )
  const bookingDates = eligibleBookings.map((booking) => booking.createdYmd)
  const bookings3d = countWithinWindow(bookingDates, predictionDay, 3)
  const bookings14d = countWithinWindow(bookingDates, predictionDay, 14)
  const bookings28d = countWithinWindow(bookingDates, predictionDay, 28)
  const activeBookingDays3d = new Set(
    eligibleBookings
      .map((booking) => booking.createdYmd)
      .filter((ymd): ymd is string => {
        const age = daysBeforeOrOn(ymd, predictionDay)
        return age != null && age < 3
      }),
  ).size

  const confirmedBookingDates = eligibleBookings
    .filter((booking) => booking.status === 'confirmed')
    .map((booking) => booking.createdYmd)
    .filter((ymd): ymd is string => ymd != null)
  const firstConfirmedBookingDay = confirmedBookingDates
    .map(ymdDayNumber)
    .filter((day): day is number => day != null)
    .reduce<number | null>(
      (earliest, day) => (earliest == null || day < earliest ? day : earliest),
      null,
    )
  const lastBookingAge = bookingDates
    .map((ymd) => daysBeforeOrOn(ymd, predictionDay))
    .filter((age): age is number => age != null)
    .reduce<number | null>(
      (smallest, age) => (smallest == null || age < smallest ? age : smallest),
      null,
    )
  const daysSinceFirstBooking =
    firstConfirmedBookingDay == null ? null : Math.max(0, predictionDay - firstConfirmedBookingDay)
  const bookingRateLifetime =
    daysSinceFirstBooking == null ? 0 : eligibleBookings.length / (daysSinceFirstBooking + 1)

  const upcomingClasses7d = eligibleBookings.reduce((count, booking) => {
    if (booking.status === 'cancelled' || !booking.classYmd) return count
    const classDay = ymdDayNumber(booking.classYmd)
    if (classDay == null) return count
    const lead = classDay - predictionDay
    return count + (lead >= 1 && lead <= 7 ? 1 : 0)
  }, 0)

  const eligibleTransactions = input.transactions.filter(
    (transaction) => daysBeforeOrOn(transaction.createdYmd, predictionDay) != null,
  )
  const transactionDates = eligibleTransactions.map((transaction) => transaction.createdYmd)
  const latestTransaction = eligibleTransactions.reduce<{
    day: number
    paymentMethod: string | null
  } | null>((latest, transaction) => {
    if (!transaction.createdYmd) return latest
    const day = ymdDayNumber(transaction.createdYmd)
    if (day == null || (latest != null && day < latest.day)) return latest
    return { day, paymentMethod: transaction.paymentMethod }
  }, null)
  const paymentMethods28d = new Set(
    eligibleTransactions
      .filter((transaction) => {
        const age = daysBeforeOrOn(transaction.createdYmd, predictionDay)
        return age != null && age < 28
      })
      .map((transaction) => transaction.paymentMethod)
      .filter((method): method is string => typeof method === 'string' && method.length > 0),
  ).size

  const subscriptionDates = input.subscriptions.map((subscription) => subscription.createdYmd)
  const signupDay = input.signupYmd ? ymdDayNumber(input.signupYmd) : null

  return {
    bookings_3d: bookings3d,
    bookings_14d: bookings14d,
    bookings_28d: bookings28d,
    bookings_lifetime: eligibleBookings.length,
    active_booking_days_3d: activeBookingDays3d,
    booking_rate_lifetime: bookingRateLifetime,
    booking_velocity_14d_vs_lifetime: bookings14d / 14 - bookingRateLifetime,
    days_since_last_booking: lastBookingAge,
    upcoming_classes_7d: upcomingClasses7d,
    transactions_3d: countWithinWindow(transactionDates, predictionDay, 3),
    transactions_7d: countWithinWindow(transactionDates, predictionDay, 7),
    payment_methods_28d: paymentMethods28d,
    subscriptions_created_14d: countWithinWindow(subscriptionDates, predictionDay, 14),
    subscriptions_created_28d: countWithinWindow(subscriptionDates, predictionDay, 28),
    days_since_signup: signupDay == null ? null : Math.max(0, predictionDay - signupDay),
    latest_payment_method: latestTransaction?.paymentMethod ?? null,
  }
}
