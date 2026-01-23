import type {
  CollectionBeforeValidateHook,
  CollectionConfig,
  Config,
  Plugin,
} from 'payload'

/**
 * Plugin to auto-set tenant on form submissions from their associated form.
 * This ensures form submissions are properly tenant-scoped even when created
 * via public API endpoints.
 */
export const tenantScopeFormSubmissions = (): Plugin => (incomingConfig: Config): Config => {
  const config = { ...incomingConfig }

  const setTenantFromForm: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
    if (!data || operation !== 'create') return data
    if (data.tenant || !data.form) return data

    const formId = typeof data.form === 'object' ? data.form.id : data.form
    if (!formId) return data

    try {
      const form = await req.payload.findByID({
        collection: 'forms',
        id: formId,
        depth: 0,
      })

      if (form?.tenant) {
        // Normalize tenant to ID (number) - form.tenant can be object or number
        const tenantId =
          typeof form.tenant === 'object' && form.tenant !== null
            ? form.tenant.id
            : form.tenant

        if (tenantId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(data as any).tenant = tenantId
        }
      }
    } catch (error) {
      // If form lookup fails, log but don't block submission
      req.payload.logger.warn(
        `Failed to set tenant for form submission: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    return data
  }

  const collections = config.collections || []
  const formSubmissionsCollection = collections.find((c) => c.slug === 'form-submissions')

  if (!formSubmissionsCollection) {
    return config
  }

  const existingHooks = formSubmissionsCollection.hooks || {}
  const existingBeforeValidate = existingHooks.beforeValidate || []

  const patched: CollectionConfig = {
    ...formSubmissionsCollection,
    hooks: {
      ...existingHooks,
      beforeValidate: [setTenantFromForm, ...existingBeforeValidate],
    },
  }

  config.collections = [
    ...collections.filter((c) => c.slug !== 'form-submissions'),
    patched,
  ]

  return config
}
