import { RegisterLoginTabsWithAuth } from '@/components/RegisterLoginTabsWithAuth'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function CompleteBooking({ searchParams }: { searchParams: SearchParams }) {
  const { mode = 'login' } = await searchParams

  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <RegisterLoginTabsWithAuth value={mode as 'login' | 'register'} />
    </div>
  )
}
