import { describe, expect, it } from 'vitest'
import { shapeBookingTemplateContext } from '@/lib/post-booking-email/build-booking-template-context'
import { replaceTemplateVars } from '@/lib/post-booking-email/replace-template-vars'

describe('replaceTemplateVars', () => {
  const context = {
    booking: {
      user: { name: 'Sam <Test>', email: 'sam@example.com' },
      timeslot: {
        eventType: { name: 'Gi Fundamentals' },
        startTime: '10:00 AM',
        staffMember: { email: 'coach@example.com', name: 'Coach' },
      },
    },
  }

  it('replaces nested booking paths', () => {
    const result = replaceTemplateVars(
      '{{booking.user.name}} has booked in for {{booking.timeslot.eventType.name}} at {{booking.timeslot.startTime}}',
      context,
    )

    expect(result).toBe('Sam <Test> has booked in for Gi Fundamentals at 10:00 AM')
  })

  it('matches path segments case-insensitively', () => {
    const result = replaceTemplateVars(
      '{{booking.Timeslot.eventtype.name}} / {{booking.timeslot.StaffMember.email}}',
      context,
    )

    expect(result).toBe('Gi Fundamentals / coach@example.com')
  })

  it('escapes HTML when requested', () => {
    const result = replaceTemplateVars('Hello {{booking.user.name}}', context, {
      escapeHtml: true,
    })

    expect(result).toBe('Hello Sam &lt;Test&gt;')
  })

  it('replaces missing paths with empty string', () => {
    expect(replaceTemplateVars('Hi {{booking.missing.value}}!', context)).toBe('Hi !')
  })
})

describe('shapeBookingTemplateContext', () => {
  it('formats timeslot date/time in the timeslot timezone', () => {
    const context = shapeBookingTemplateContext({
      id: 42,
      status: 'confirmed',
      user: { name: 'Alex', email: 'alex@example.com' },
      tenant: { name: 'Kyuzo', slug: 'kyuzo' },
      timeslot: {
        date: '2026-07-10',
        startTime: '2026-07-10T09:00:00.000Z',
        endTime: '2026-07-10T10:00:00.000Z',
        location: 'Mat 1',
        eventType: { name: 'No-Gi', description: 'Open mat' },
        staffMember: { name: 'Pat', email: 'pat@example.com' },
        branch: { name: 'City Centre' },
        tenant: { timeZone: 'Europe/Dublin' },
      },
    })

    const body = replaceTemplateVars(
      '{{booking.user.name}} booked {{booking.timeslot.eventType.name}} with {{booking.timeslot.staffMember.name}} at {{booking.timeslot.startTime}} on {{booking.timeslot.date}} ({{booking.timeslot.location}}, {{booking.timeslot.branch.name}})',
      context,
    )

    expect(body).toBe(
      'Alex booked No-Gi with Pat at 10:00 AM on Friday, 10 July 2026 (Mat 1, City Centre)',
    )
    expect(
      replaceTemplateVars('{{booking.timeslot.staffMember.email}}', context),
    ).toBe('pat@example.com')
  })
})
