import { RegisterLoginTabs } from '@repo/auth/src/components/register-login-tabs'
import { Modal } from '../modal'

export default function Unauthenticated() {
  return (
    <Modal>
      <RegisterLoginTabs value="login" />
    </Modal>
  )
}
