import { describe, expect, it } from 'vitest'
import {
  resolveActiveCourseEmailConfigs,
  resolveCourseEmailConfigById,
} from '@/lib/course-email/types'

describe('resolveActiveCourseEmailConfigs', () => {
  it('keeps only configs with id, subject, replyTo, and sendTiming', () => {
    const configs = resolveActiveCourseEmailConfigs({
      courseEmails: [
        {
          id: 'a',
          subject: 'Welcome',
          replyTo: 'hi@example.com',
          sendTiming: 'after_purchase',
          message: { root: {} },
        },
        { id: 'b', subject: 'Missing reply', sendTiming: 'after_purchase' },
        {
          id: 'c',
          subject: 'Before start',
          replyTo: 'hi@example.com',
          sendTiming: 'one_day_before_start',
        },
      ],
    })
    expect(configs.map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('returns empty for missing array', () => {
    expect(resolveActiveCourseEmailConfigs({})).toEqual([])
  })
})

describe('resolveCourseEmailConfigById', () => {
  it('finds by id', () => {
    const config = resolveCourseEmailConfigById(
      {
        courseEmails: [
          {
            id: 'x',
            subject: 'Hi',
            replyTo: 'a@b.com',
            sendTiming: 'after_purchase',
          },
        ],
      },
      'x',
    )
    expect(config?.subject).toBe('Hi')
  })
})
