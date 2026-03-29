import { RegisterLoginTabsWithAuth } from '@/components/RegisterLoginTabsWithAuth'
import { Modal } from '../modal'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function CompleteBooking({ searchParams }: { searchParams: SearchParams }) {
  const { mode = 'login' } = await searchParams

  return (
    <Modal>
      <RegisterLoginTabsWithAuth value={mode as 'login' | 'register'} />
    </Modal>
  )
}
