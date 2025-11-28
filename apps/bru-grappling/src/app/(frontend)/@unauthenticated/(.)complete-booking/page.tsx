import { RegisterLoginTabs } from '@repo/auth-next'
import { Modal } from '../modal'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function CompleteBooking({ searchParams }: { searchParams: SearchParams }) {
  const { mode = 'login' } = await searchParams

  return (
    <Modal>
      <RegisterLoginTabs value={mode as 'login' | 'register'} />
    </Modal>
  )
}
