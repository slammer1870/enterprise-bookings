import type { PostBookingEmailBatchContext } from './types'
import type { PostBookingEmailSendTiming } from '@/fields/postBookingEmailFields'

export function resolvePostBookingEmailBatchContext(
  context: Record<string, unknown> | undefined,
): PostBookingEmailBatchContext {
  const batch = context?.postBookingEmailBatch as PostBookingEmailBatchContext | undefined
  if (
    batch &&
    typeof batch.batchSize === 'number' &&
    batch.batchSize > 0 &&
    typeof batch.batchIndex === 'number' &&
    batch.batchIndex >= 0
  ) {
    return batch
  }
  return { batchSize: 1, batchIndex: 0 }
}

export function shouldTriggerPostBookingEmailForBatch(
  sendTiming: PostBookingEmailSendTiming,
  batch: PostBookingEmailBatchContext,
): boolean {
  if (sendTiming === 'after_first_booking' || sendTiming === 'next_day_after_first_booking') {
    return batch.batchIndex === 0
  }
  if (sendTiming === 'after_all_bookings') {
    return batch.batchIndex === batch.batchSize - 1
  }
  return false
}

export function mergePostBookingEmailBatchContext(
  existingContext: Record<string, unknown> | undefined,
  batch: PostBookingEmailBatchContext,
): Record<string, unknown> {
  return {
    ...(existingContext ?? {}),
    postBookingEmailBatch: batch,
  }
}
