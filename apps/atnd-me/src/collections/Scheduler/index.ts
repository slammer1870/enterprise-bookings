import type { Access, CollectionConfig, Field, Payload, Where } from 'payload'
import { extractUtcWallClock } from '@repo/shared-utils'
import {
    tenantScopedCreate,
    tenantScopedUpdate,
    tenantScopedDelete,
    tenantScopedReadFiltered,
} from '../../access/tenant-scoped'
import { isStaffOnlyUser, tenantOrgPayloadAdminAccess } from '../../access/userTenantAccess'
import { getPayloadLocationIdFromRequest } from '../../utilities/tenantRequest'

function relationId(value: unknown): number | null {
    if (value == null || value === '') return null
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
    if (typeof value === 'object' && value !== null && 'id' in value) {
        const id = (value as { id: unknown }).id
        if (typeof id === 'number' && Number.isFinite(id)) return id
        if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
    }
    return null
}

/**
 * Read access for Scheduler: extends tenant-scoped filtering with an optional branch
 * filter when `payload-location` cookie is set. This scopes the list so that each
 * location's scheduler is shown independently when a branch is selected.
 */
const schedulerReadAccess: Access = async (args) => {
    const { req } = args
    const base = await tenantScopedReadFiltered(args)
    if (base === false) return false

    const typedReq = req as typeof req & { cookies?: { get: (name: string) => { value?: string } | undefined } }
    const cookieSrc = typedReq.cookies?.get ? { cookies: typedReq.cookies } : {}
    const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)
    if (selectedBranchId == null) return base

    const branchFilter: Where = { branch: { equals: selectedBranchId } }
    if (base === true) return branchFilter
    return { and: [base as Where, branchFilter] }
}

// Multi-tenant Scheduler collection (converted from scheduler global)
// Each location has its own scheduler document when the tenant has multiple sites.
// Fields are based on the bookings plugin scheduler global
const days: Field = {
    name: 'days',
    label: 'Days',
    type: 'array',
    minRows: 7,
    maxRows: 7,
    admin: {
        components: {
            RowLabel: '@repo/bookings-plugin/src/components/scheduler/day-row-label#DayRowLabel',
        },
    },
    fields: [
        {
            name: 'timeSlot',
            type: 'array',
            required: false,
            validate: (value: unknown) => {
                if (!value || !Array.isArray(value)) return true

                type TimeSlot = { location?: unknown; startTime?: string; endTime?: string }
                // Check for time and location conflicts within the same day
                for (let i = 0; i < value.length; i++) {
                    const currentSlot = value[i] as TimeSlot

                    for (let j = i + 1; j < value.length; j++) {
                        const otherSlot = value[j] as TimeSlot

                        // Skip if different locations
                        if (currentSlot.location !== otherSlot.location) continue
                        if (!currentSlot.startTime || !currentSlot.endTime || !otherSlot.startTime || !otherSlot.endTime) continue

                        const currentStart = extractUtcWallClock(currentSlot.startTime)
                        const currentEnd = extractUtcWallClock(currentSlot.endTime)
                        const otherStart = extractUtcWallClock(otherSlot.startTime)
                        const otherEnd = extractUtcWallClock(otherSlot.endTime)

                        const currentStartMinutes = currentStart.hours * 60 + currentStart.minutes
                        const currentEndMinutes = currentEnd.hours * 60 + currentEnd.minutes
                        const otherStartMinutes = otherStart.hours * 60 + otherStart.minutes
                        const otherEndMinutes = otherEnd.hours * 60 + otherEnd.minutes

                        // Two local wall-clock ranges overlap if each starts before the other ends.
                        const hasTimeOverlap =
                          currentStartMinutes < otherEndMinutes &&
                          otherStartMinutes < currentEndMinutes

                        if (hasTimeOverlap) {
                            return `Time Slot ${String(i + 1).padStart(2, '0')} and Time Slot ${String(j + 1).padStart(2, '0')} overlap for the same location (${currentSlot.location}) — please adjust their start or end times`
                        }
                    }
                }
                return true
            },
            fields: [
                {
                    name: 'startTime',
                    type: 'date',
                    required: true,
                    admin: {
                        date: {
                            pickerAppearance: 'timeOnly',
                        },
                    },
                },
                {
                    name: 'endTime',
                    type: 'date',
                    required: true,
                    admin: {
                        date: {
                            pickerAppearance: 'timeOnly',
                        },
                    },
                },
                {
                    name: 'eventType',
                    type: 'relationship',
                    relationTo: 'event-types',
                    admin: {
                        description: 'Overrides the default class option',
                    },
                },
                {
                    name: 'location',
                    type: 'text',
                },
                {
                    name: 'staffMember',
                    type: 'relationship',
                    relationTo: 'staff-members',
                },
                {
                    name: 'lockOutTime',
                    type: 'number',
                    admin: {
                        description: 'Overrides the default lock out time',
                    },
                },
                {
                    name: 'active',
                    type: 'checkbox',
                    defaultValue: true,
                    admin: {
                        description: 'Whether the time slot is active and will be shown on the schedule',
                    },
                },
            ],
        },
    ],
}

export const Scheduler: CollectionConfig = {
    slug: 'scheduler',
    labels: {
        singular: 'Scheduler',
        plural: 'Scheduler',
    },
    admin: {
        useAsTitle: 'branch',
        defaultColumns: ['branch', 'tenant', 'startDate', 'endDate', 'updatedAt'],
        group: 'Bookings',
        description: 'Create recurring timeslots for each location. Select a site in the sidebar to view or edit that location\'s schedule.',
        components: {
            views: {
                list: {
                    Component: '@/components/admin/SchedulerListView',
                },
            },
        },
    },
    access: {
        admin: tenantOrgPayloadAdminAccess,
        read: schedulerReadAccess,
        create: async (args) => {
            if (isStaffOnlyUser(args.req.user)) return false
            return tenantScopedCreate(args)
        },
        update: async (args) => {
            if (isStaffOnlyUser(args.req.user)) return false
            return tenantScopedUpdate(args)
        },
        delete: async (args) => {
            if (isStaffOnlyUser(args.req.user)) return false
            return tenantScopedDelete(args)
        },
    },
    hooks: {
        beforeValidate: [
            async ({ data, operation, req }) => {
                // Ensure tenant field is set on create if not already provided
                // Use beforeValidate so it runs before plugin validation
                if (operation === 'create' && data && !data.tenant) {
                    // Try to get tenant from context (set by middleware or tests)
                    const rawTenant = req.context?.tenant as unknown
                    if (rawTenant) {
                        // `tenant` may be a primitive ID or an object with an `id` field
                        data.tenant =
                            typeof rawTenant === 'object' && 'id' in rawTenant
                                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (rawTenant as any).id
                                : (rawTenant as string | number)
                    }
                }

                // Auto-set branch from the payload-location cookie on create.
                // The branch field is hidden in the admin UI; the sidebar selector
                // controls which location is active, and we read it here so the
                // newly created scheduler document is automatically linked to the
                // correct branch without requiring the user to set it manually.
                if (operation === 'create' && data && !data.branch) {
                    const typedReq = req as typeof req & { cookies?: { get: (name: string) => { value?: string } | undefined } }
                    const cookieSrc = typedReq.cookies?.get ? { cookies: typedReq.cookies } : {}
                    const cookieBranchId = getPayloadLocationIdFromRequest(cookieSrc)
                    if (cookieBranchId != null) {
                        data.branch = cookieBranchId
                    }
                }

                // Require branch when the tenant has more than one active location.
                // Only enforced for authenticated user requests (admin UI / REST API).
                // Programmatic Local API calls (seed scripts, task runners, test helpers)
                // are allowed to omit the branch because they operate outside the UI flow.
                if (data && req.user != null) {
                    const branchId = relationId(data.branch)
                    if (branchId == null) {
                        const tenantId = relationId(data.tenant ?? req.context?.tenant)
                        if (tenantId != null) {
                            const locs = await req.payload.find({
                                collection: 'locations',
                                where: {
                                    and: [
                                        { tenant: { equals: tenantId } },
                                        { active: { equals: true } },
                                    ],
                                },
                                limit: 2,
                                depth: 0,
                                overrideAccess: true,
                            })
                            if (locs.totalDocs > 1) {
                                throw new Error(
                                    'A branch must be selected when the tenant has more than one active site.',
                                )
                            }
                        }
                    }
                }

                // Strip incomplete timeSlot rows (missing startTime or endTime) before
                // validation runs. Payload's duplicate-row feature in nested arrays copies
                // the internal row `id`, creating two rows with the same React key. This
                // causes the remove button to appear broken (row reappears). Stripping
                // incomplete rows on save keeps the DB clean and prevents the generate-
                // timeslots task from creating bogus epoch-date timeslots.
                if (data?.week?.days && Array.isArray(data.week.days)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data.week.days = (data.week.days as any[]).map((day: any) => {
                        if (!day?.timeSlot || !Array.isArray(day.timeSlot)) return day
                        const filtered = day.timeSlot.filter(
                            (slot: any) =>
                                slot?.startTime != null &&
                                slot?.startTime !== '' &&
                                slot?.endTime != null &&
                                slot?.endTime !== '',
                        )
                        // Sort slots by wall-clock start time so the UI always shows them in order.
                        filtered.sort((a: any, b: any) => {
                            const at = extractUtcWallClock(a.startTime)
                            const bt = extractUtcWallClock(b.startTime)
                            return (at.hours * 60 + at.minutes) - (bt.hours * 60 + bt.minutes)
                        })
                        return { ...day, timeSlot: filtered }
                    })
                }

                return data
            },
        ],
        afterChange: [
            async ({ req, doc }) => {
                // Extract tenant from scheduler document
                const tenantId = typeof doc.tenant === 'object' && doc.tenant !== null ? doc.tenant.id : doc.tenant

                const branchRaw = (doc as { branch?: unknown }).branch
                const branchId =
                    branchRaw == null
                        ? undefined
                        : typeof branchRaw === 'object' && branchRaw !== null && 'id' in branchRaw
                            ? (branchRaw as { id: number }).id
                            : typeof branchRaw === 'number'
                                ? branchRaw
                                : typeof branchRaw === 'string' && /^\d+$/.test(branchRaw)
                                    ? parseInt(branchRaw, 10)
                                    : undefined

                // Set tenant context in req so the job inherits it
                // This ensures all queries in the job are filtered by tenant
                if (tenantId) {
                    req.context = {
                        ...req.context,
                        tenant: tenantId,
                    }
                }

                const job = await req.payload.jobs.queue({
                    task: 'generateTimeslotsFromSchedule',
                    input: {
                        startDate: doc.startDate,
                        endDate: doc.endDate,
                        week: doc.week,
                        clearExisting: doc.clearExisting,
                        defaultEventType: doc.defaultEventType,
                        lockOutTime: doc.lockOutTime,
                        tenant: tenantId,
                        ...(branchId != null ? { branch: branchId } : {}),
                    } as Parameters<Payload['jobs']['queue']>[0]['input'],
                })

                if (job.id) {
                    // Fire-and-forget: run in the background so the save response is
                    // returned to the browser immediately. Without this the HTTP request
                    // stays open for the entire generation duration, which (a) shows an
                    // indefinite "saving…" state and (b) lets the browser's leave-page
                    // guard cancel the request mid-job if the user navigates away.
                    // The job is already persisted in the DB by jobs.queue() above, so
                    // it can also be retried by a cron runner if the process exits early.
                    void req.payload.jobs.runByID({
                        id: job.id,
                        // Pass req to maintain tenant context
                        req,
                    })
                }

                return doc
            },
        ],
    },
    fields: [
        {
            name: 'startDate',
            type: 'date',
            required: true,
            admin: {
                description: 'When this schedule becomes active',
                date: {
                    pickerAppearance: 'dayOnly',
                    displayFormat: 'dd/MM/yyyy',
                },
            },
        },
        {
            name: 'endDate',
            type: 'date',
            required: true,
            admin: {
                description: 'When this schedule stops generating timeslots',
                date: {
                    pickerAppearance: 'dayOnly',
                    displayFormat: 'dd/MM/yyyy',
                },
            },
            validate: (value, { data }: { data: { startDate?: string } }) => {
                // Check if end date is after start date
                if (value && data?.startDate) {
                    const endDate = new Date(value)
                    const startDate = new Date(data.startDate)
                    if (endDate <= startDate) {
                        return 'End date must be after start date'
                    }
                }
                return true
            },
        },
        {
            name: 'lockOutTime',
            label: 'Default Lock Out Time (minutes)',
            type: 'number',
            defaultValue: 0,
            required: true,
            admin: {
                description: 'Minutes before start time when booking closes (can be overridden per slot)',
            },
        },
        {
            name: 'defaultEventType',
            label: 'Default Class Option',
            type: 'relationship',
            relationTo: 'event-types',
            required: true,
            admin: {
                description: 'Default class type to use when creating timeslots (can be overridden per slot)',
            },
        },
        {
            name: 'branch',
            label: 'Branch / site',
            type: 'relationship',
            relationTo: 'locations',
            required: false,
            // Hidden in the edit form — the sidebar branch selector controls which
            // location is active, and the beforeValidate hook auto-sets this on create.
            admin: {
                hidden: true,
            },
            filterOptions: ({ data }) => {
                const raw = data?.tenant
                const tid =
                    raw == null
                        ? null
                        : typeof raw === 'object' && raw !== null && 'id' in raw
                          ? (raw as { id: number }).id
                          : typeof raw === 'number'
                            ? raw
                            : typeof raw === 'string' && /^\d+$/.test(raw)
                              ? parseInt(raw, 10)
                              : null
                if (tid == null) return false
                return {
                    tenant: { equals: tid },
                    active: { equals: true },
                }
            },
        },
        {
            name: 'week',
            label: 'Week',
            admin: {
                description: 'The days of the week and their time slots',
            },
            type: 'group',
            fields: [days],
        },
        {
            name: 'clearExisting',
            type: 'checkbox',
            label: 'Clear Existing Timeslots',
            defaultValue: false,
            admin: {
                description:
                    'Clear existing timeslots before generating new ones (this will not delete timeslots that have any bookings)',
            },
        },
    ],
    timestamps: true,
}
