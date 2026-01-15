import { RegisterLoginTabs } from '@repo/auth-next'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function CompleteBooking({ searchParams }: { searchParams: SearchParams }) {
  const { mode = 'login' } = await searchParams

  return <RegisterLoginTabs value={mode as 'login' | 'register'} />
}
