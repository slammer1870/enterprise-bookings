import { getMeUser } from '@repo/auth'
import { RegisterLoginTabs } from '@repo/auth'
import { Modal } from '../modal'

export default async function Unauthenticated() {
  const user = await getMeUser({ validUserRedirect: '/dashboard' })
  
  return (
    <Modal>
      <RegisterLoginTabs value="login" />
    </Modal>
  )
}
