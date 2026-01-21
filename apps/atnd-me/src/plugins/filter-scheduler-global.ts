import type { Config, Plugin } from 'payload'

/**
 * Plugin to filter out the scheduler global that the bookings plugin adds
 * since we're using a Scheduler collection instead for multi-tenant support
 */
export const filterSchedulerGlobal: Plugin = (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }

  // Filter out the scheduler global if it exists
  if (config.globals) {
    config.globals = config.globals.filter((global) => global.slug !== 'scheduler')
  }

  return config
}
