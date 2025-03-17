import Link from 'next/link'

export default function BookingConfirmedPage() {
  return (
    <div className="h-[80vh] flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-medium -mt-16 mb-2">Booking confirmed</h2>
      <p className="text-sm text-gray-500 mb-2">
        Your booking has been confirmed. Please check your email for the booking details.
      </p>
      <Link href="/" className="text-sm font-medium underline">
        Click here to go back home
      </Link>
    </div>
  )
}
