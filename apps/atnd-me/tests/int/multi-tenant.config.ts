import config from '@/payload.config'

// For now we simply re-export the main config.
// As multi-tenant needs special test setup, we can
// evolve this file to override db, plugins, or collections
// specifically for integration tests.

export default config

