import { RegisterLoginTabs } from '@repo/auth-next'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function CompleteBooking({ searchParams }: { searchParams: SearchParams }) {
  const { mode = 'login' } = await searchParams

  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <RegisterLoginTabs value={mode as 'login' | 'register'} />
    </div>
  )
}
