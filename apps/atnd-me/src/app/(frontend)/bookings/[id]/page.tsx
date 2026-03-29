import { createBookingPage, bookingPageConfig } from '@/lib/booking'

export const dynamic = 'force-dynamic'

type BookingPageProps = {
  params: Promise<{ id: string }>
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params
  return createBookingPage(id, bookingPageConfig)
}
