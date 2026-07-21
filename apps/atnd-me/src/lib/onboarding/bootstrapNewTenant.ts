import type { Payload, PayloadRequest } from 'payload'

import { ensureDefaultTenantLogo } from '@/lib/onboarding/createDefaultTenantLogo'

/**
 * Minimal bootstrap so a newly claimed tenant can complete the onboarding checklist
 * (event type + schedule) without manual Payload setup.
 *
 * Creates:
 * - default active location/branch
 * - published home page with a schedule-friendly hero block
 * - default monogram logo from the company name (first letter / initials)
 */
export async function bootstrapNewTenant(
  payload: Payload,
  tenantId: number,
  tenantName: string,
  req?: PayloadRequest,
): Promise<void> {
  const existingLocations = await payload.find({
    collection: 'locations',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (!existingLocations.docs[0]) {
    await payload.create({
      collection: 'locations',
      data: {
        name: tenantName,
        slug: 'main',
        tenant: tenantId,
        active: true,
      },
      overrideAccess: true,
      req,
    })
  }

  const existingHome = await payload.find({
    collection: 'pages',
    where: {
      and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenantId } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (!existingHome.docs[0]) {
    await payload.create({
      collection: 'pages',
      data: {
        slug: 'home',
        title: `Welcome to ${tenantName}`,
        _status: 'published',
        tenant: tenantId,
        layout: [
          {
            blockType: 'heroScheduleSanctuary',
            blockName: 'Hero Schedule',
            displayHeading: tenantName,
          },
        ],
      },
      overrideAccess: true,
      req,
    })
  }

  try {
    await ensureDefaultTenantLogo({ payload, tenantId, tenantName, req })
  } catch (error) {
    payload.logger?.warn?.(
      `bootstrapNewTenant: could not create default logo for tenant ${tenantId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}
