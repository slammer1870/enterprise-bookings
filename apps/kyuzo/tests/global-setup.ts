import { type FullConfig } from '@playwright/test'
import { initPayloadE2ENoConfig } from './helpers/initE2E'
import { Config } from '../src/payload-types'
import path from 'path'
import { fileURLToPath } from 'url'
import { PayloadTestSDK } from './sdk'

let payload: PayloadTestSDK<Config>

async function globalSetup(config: FullConfig) {
  const filename = fileURLToPath(import.meta.url)
  const dirname = path.dirname(filename)
  ;({ payload } = await initPayloadE2ENoConfig<Config>({ dirname }))

  try {
    await payload.create({
      collection: 'pages',
      data: {
        title: 'Home',
        slug: 'home',
      },
    })
  } catch (error) {
    console.error('Error creating admin user:', error)
  }
}

export default globalSetup
