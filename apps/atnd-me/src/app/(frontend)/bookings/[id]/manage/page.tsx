import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/context/get-context-props'
import { createCaller } from '@/trpc/server'
import { ManageBookingPageClient } from '@repo/bookings-next'

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

    // Fetch lesson via tRPC
    const caller = await createCaller()

    try {
        // Fetch user's bookings first to verify they have multiple bookings
        const userBookings = await caller.bookings.getUserBookingsForLesson({ lessonId: id })

        // If user has only one or no bookings, redirect to regular booking page
        // Use explicit check to ensure redirect happens even if array is undefined/null
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
                <ManageBookingPageClient lesson={lesson} />
            </div>
        )
    } catch (error: any) {
        // Handle tRPC errors - redirect on validation errors
        if (error?.data?.code === 'NOT_FOUND' || error?.data?.code === 'BAD_REQUEST') {
            redirect('/')
        }
        // Re-throw other errors
        throw error
    }
}
