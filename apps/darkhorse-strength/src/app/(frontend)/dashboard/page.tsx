import { getMeUser } from '@repo/auth/src/utils/get-me-user'

import ScheduleComponent from '@/components/schedule'

export default async function Dashboard() {
  const { user } = await getMeUser({ nullUserRedirect: '/login' })

  return (
    <div className="container mx-auto pt-24 px-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-sm text-gray-500">Welcome {user.name}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScheduleComponent />
        <ScheduleComponent />
      </div>
    </div>
  )
}
