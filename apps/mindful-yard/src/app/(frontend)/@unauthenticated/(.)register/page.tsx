import { RegisterLoginTabs } from '@repo/auth-next'
import { Modal } from '../modal'

export default function Unauthenticated() {
  return (
    <Modal>
      <RegisterLoginTabs value="register" />
    </Modal>
  )
}
