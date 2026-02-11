import { redirect } from 'next/navigation'
import { headers as nextHeaders } from 'next/headers'
import { getSession } from '@/lib/auth/context/get-context-props'
import { createCaller } from '@/trpc/server'
import { ManageBookingPageClient } from '@repo/bookings-next'
import { PaymentMethodsConnect } from '@/components/payments/PaymentMethodsConnect.client'

// Uses getSession()/headers() and createCaller(); must be dynamic in production (avoids DYNAMIC_SERVER_USAGE in E2E).
export const dynamic = 'force-dynamic'

type ManageBookingPageProps = {
    params: Promise<{ id: string }>
}

export default async function ManageBookingPage({ params }: ManageBookingPageProps) {
    const { id: idParam } = await params

    // Convert string ID to number and validate
    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
        redirect('/')
    }

    // Auth check
    const session = await getSession()
    const user = session?.user

    if (!user) {
        redirect(`/auth/sign-in?callbackUrl=/bookings/${id}/manage`)
    }

    // Pass request host so tenant is resolved from subdomain when cookie isn't set yet
    // (e.g. navigating from schedule to manage page; avoids redirect to home)
    const h = await nextHeaders()
    const host = h.get('host') ?? h.get('x-forwarded-host') ?? ''
    const caller = await createCaller(host ? { host } : undefined)

    try {
        // Fetch user's bookings first to verify they have multiple bookings
        const userBookings = await caller.bookings.getUserBookingsForLesson({ lessonId: id })

        // Must have at least one booking to manage.
        // Use explicit check to ensure redirect happens even if array is undefined/null.
        const bookingCount = userBookings?.length ?? 0
        if (bookingCount === 0) {
            redirect(`/bookings/${id}`)
        }

        // Use getById instead of getByIdForBooking since we're managing existing bookings
        // getByIdForBooking rejects lessons that are 'booked' or 'closed', but we need
        // to allow access to manage bookings even if the lesson is fully booked
        const lesson = await caller.lessons.getById({ id })

        return (
            <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
                <ManageBookingPageClient
                    lesson={lesson}
                    initialBookings={userBookings}
                    PaymentMethodsComponent={PaymentMethodsConnect}
                />
            </div>
        )
    } catch (error: unknown) {
        // Handle tRPC errors - redirect on validation errors
        const err = error as { data?: { code?: string } }
        if (err?.data?.code === 'NOT_FOUND' || err?.data?.code === 'BAD_REQUEST') {
            redirect('/')
        }
        // Re-throw other errors
        throw error
    }
}
