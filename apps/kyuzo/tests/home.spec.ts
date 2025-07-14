import { test, expect, type Page } from '@playwright/test'
import { initPayloadE2ENoConfig } from './helpers/initE2E'
import path from 'path'
import { PayloadTestSDK } from './sdk'

import { Config } from '../src/payload-types'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

let payload: PayloadTestSDK<Config>
let serverURL: string

test.describe('Home', () => {
  test.beforeAll(async () => {
    ;({ payload, serverURL } = await initPayloadE2ENoConfig<Config>({ dirname }))

    await payload.create({
      collection: 'pages',
      data: {
        title: 'Home',
        slug: 'home',
      },
    })
  })

  test('has title', async ({ page }) => {
    await page.goto('http://localhost:3000')

    // Check that the page title is kyuzo
    await expect(page.getByRole('heading', { name: 'Kyuzo Brazilian Jiu Jitsu' })).toBeVisible()
  })
})
