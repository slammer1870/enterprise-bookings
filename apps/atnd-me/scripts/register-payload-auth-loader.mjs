import { register } from 'node:module'

// Node 22+ prefers `--import` + `register()` over `--experimental-loader`.
// Register our custom resolver so Node can load `payload-auth`'s published ESM output
// (which contains extensionless and directory specifiers).
const loaderURL = new URL('./payload-auth-loader.mjs', import.meta.url)
register(loaderURL.href, import.meta.url)

