import type { Account, DeviceSession, Session } from '@/lib/auth/types'
import { getPayload } from '@/lib/payload'
import type { TypedUser } from 'payload'
import { headers as requestHeaders } from 'next/headers'

export const getSession = async (): Promise<Session | null> => {
  const payload = await getPayload()
  const headers = await requestHeaders()
  const session = await payload.betterAuth.api.getSession({ headers })
  return session
}

export const getUserAccounts = async (): Promise<Account[]> => {
  const payload = await getPayload()
  const headers = await requestHeaders()
  const accounts = await payload.betterAuth.api.listUserAccounts({ headers })
  return accounts
}

export const getDeviceSessions = async (): Promise<DeviceSession[]> => {
  const payload = await getPayload()
  const headers = await requestHeaders()
  const sessions = await payload.betterAuth.api.listSessions({ headers })
  return sessions
}

export const currentUser = async (): Promise<TypedUser | null> => {
  const payload = await getPayload()
  const headers = await requestHeaders()
  const { user } = await payload.auth({ headers })
  return user
}

export const getContextProps = (): {
  sessionPromise: Promise<Session | null>
  userAccountsPromise: Promise<Account[]>
  deviceSessionsPromise: Promise<DeviceSession[]>
  currentUserPromise: Promise<TypedUser | null>
} => {
  const sessionPromise = getSession()
  const userAccountsPromise = getUserAccounts()
  const deviceSessionsPromise = getDeviceSessions()
  const currentUserPromise = currentUser()
  return { sessionPromise, userAccountsPromise, deviceSessionsPromise, currentUserPromise }
}







