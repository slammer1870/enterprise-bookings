import { RegisterLoginTabs } from '@repo/auth'
import { Modal } from '../modal'

export default function Unauthenticated() {
  return (
    <Modal>
      <RegisterLoginTabs value="login" />
    </Modal>
  )
}
