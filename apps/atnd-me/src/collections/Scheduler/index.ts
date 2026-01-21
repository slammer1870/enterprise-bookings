import type { CollectionConfig, Field } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import {
    tenantScopedCreate,
    tenantScopedUpdate,
    tenantScopedDelete,
    tenantScopedReadFiltered,
} from '../../access/tenant-scoped'

// Multi-tenant Scheduler collection (converted from scheduler global)
// Each tenant has one scheduler document
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
            validate: (value: any) => {
                if (!value || !Array.isArray(value)) return true

                // Check for time and location conflicts within the same day
                for (let i = 0; i < value.length; i++) {
                    const currentSlot = value[i] as any

                    for (let j = i + 1; j < value.length; j++) {
                        const otherSlot = value[j] as any

                        // Skip if different locations
                        if (currentSlot.location !== otherSlot.location) continue

                        // Check for time overlap
                        const currentStart = new Date(currentSlot.startTime)
                        const currentEnd = new Date(currentSlot.endTime)
                        const otherStart = new Date(otherSlot.startTime)
                        const otherEnd = new Date(otherSlot.endTime)

                        // Normalize to just time comparison by setting same date
                        currentStart.setFullYear(2000, 0, 1)
                        currentEnd.setFullYear(2000, 0, 1)
                        otherStart.setFullYear(2000, 0, 1)
                        otherEnd.setFullYear(2000, 0, 1)

                        // Two time periods overlap if: start1 < end2 AND start2 < end1
                        const hasTimeOverlap = currentStart < otherEnd && currentStart > otherStart

                        if (hasTimeOverlap) {
                            return 'Time slots cannot overlap for the same location on the same day'
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
                    name: 'classOption',
                    type: 'relationship',
                    relationTo: 'class-options',
                    admin: {
                        description: 'Overrides the default class option',
                    },
                },
                {
                    name: 'location',
                    type: 'text',
                },
                {
                    name: 'instructor',
                    type: 'relationship',
                    relationTo: 'instructors',
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
    admin: {
        useAsTitle: 'tenant',
        defaultColumns: ['tenant', 'startDate', 'endDate', 'updatedAt'],
        group: 'Bookings',
        description: 'Create recurring lessons across your weekly schedule for each tenant',
    },
    access: {
        admin: ({ req: { user } }) => {
            if (!user) return false
            return checkRole(['admin', 'tenant-admin'], user as unknown as SharedUser)
        },
        read: tenantScopedReadFiltered,
        create: tenantScopedCreate,
        update: tenantScopedUpdate,
        delete: tenantScopedDelete,
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
                return data
            },
        ],
        afterChange: [
            async ({ req, doc }) => {
                // Extract tenant from scheduler document
                const tenantId = typeof doc.tenant === 'object' && doc.tenant !== null ? doc.tenant.id : doc.tenant

                // Set tenant context in req so the job inherits it
                // This ensures all queries in the job are filtered by tenant
                if (tenantId) {
                    req.context = {
                        ...req.context,
                        tenant: tenantId,
                    }
                }

                const job = await req.payload.jobs.queue({
                    task: 'generateLessonsFromSchedule',
                    input: {
                        startDate: doc.startDate,
                        endDate: doc.endDate,
                        week: doc.week,
                        clearExisting: doc.clearExisting,
                        defaultClassOption: doc.defaultClassOption,
                        lockOutTime: doc.lockOutTime,
                        // Pass tenant explicitly in input as backup
                        tenant: tenantId,
                    } as any, // Type assertion needed since package type doesn't include tenant yet
                })

                if (job.id) {
                    await req.payload.jobs.runByID({
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
                description: 'When this schedule stops generating lessons',
                date: {
                    pickerAppearance: 'dayOnly',
                    displayFormat: 'dd/MM/yyyy',
                },
            },
            validate: (value, { data }: { data: any }) => {
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
            name: 'defaultClassOption',
            label: 'Default Class Option',
            type: 'relationship',
            relationTo: 'class-options',
            required: true,
            admin: {
                description: 'Default class type to use when creating lessons (can be overridden per slot)',
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
            label: 'Clear Existing Lessons',
            defaultValue: false,
            admin: {
                description:
                    'Clear existing lessons before generating new ones (this will not delete lessons that have any bookings)',
            },
        },
    ],
    timestamps: true,
}
