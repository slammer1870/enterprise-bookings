import type { Config, Plugin } from 'payload'

type ExportJobInput = {
  tenantScope?: number | null
}

/**
 * Restore the admin tenant selector context when queued export jobs run.
 * Without this, background exports may include all of a tenant admin's assigned tenants
 * instead of only the tenant selected in the Payload admin UI.
 */
export const tenantScopedExportJobsPlugin = (): Plugin => (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }
  const tasks = config.jobs?.tasks ?? []

  const patchedTasks = tasks.map((task) => {
    if (task.slug !== 'createCollectionExport') {
      return task
    }

    const originalHandler = task.handler
    if (typeof originalHandler !== 'function') {
      return task
    }

    return {
      ...task,
      handler: async (args: { input: ExportJobInput; req: { context?: Record<string, unknown> } }) => {
        const tenantScope = args.input?.tenantScope
        if (tenantScope != null && Number.isFinite(tenantScope)) {
          args.req.context = {
            ...(args.req.context ?? {}),
            tenant: tenantScope,
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (originalHandler as (handlerArgs: any) => Promise<unknown>)(args)
      },
    }
  })

  config.jobs = {
    ...config.jobs,
    // Plugin task handlers are widened at runtime after import-export registers createCollectionExport.
    tasks: patchedTasks as typeof tasks,
  }

  return config
}
