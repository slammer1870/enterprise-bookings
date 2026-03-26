import { RegisterLoginTabsWithAuth } from '@/components/RegisterLoginTabsWithAuth'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function CompleteBooking({ searchParams }: { searchParams: SearchParams }) {
  const { mode = 'login' } = await searchParams

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
      <RegisterLoginTabsWithAuth value={mode as 'login' | 'register'} />
    </div>
  )
}
