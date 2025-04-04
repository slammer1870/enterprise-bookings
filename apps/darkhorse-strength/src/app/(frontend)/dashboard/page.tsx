import { getMeUser } from '@repo/auth/src/utils/get-me-user'

export default async function Dashboard() {
  const { user } = await getMeUser({ nullUserRedirect: '/login' })

  return <div>Dashboard</div>
}
