'use server'

import mailchimp from '@mailchimp/mailchimp_marketing'
import crypto from 'crypto'

import { CollectionAfterChangeHook } from 'payload'

export const newsletter: CollectionAfterChangeHook = async ({ data, req }) => {
  const { name, email } = data
  const [first, ...last] = (name || '').split(' ')
  const subscriberHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex')

  try {
    // Try to add to Mailchimp
    await mailchimp.lists.addListMember(process.env.MAILCHIMP_LIST_ID!, {
      email_address: email,
      merge_fields: {
        FNAME: first || '',
        LNAME: last.join(' '),
      },
      status: 'subscribed',
      tags: ['newsletter'],
    })

    req.payload.logger.info('Newsletter subscribed', { email, name })

    return data
  } catch (err: any) {
    // Handle "Member Exists"
    const errorBody = err.response?.body
    if (errorBody?.title === 'Member Exists') {
      await mailchimp.lists.updateListMemberTags(process.env.MAILCHIMP_LIST_ID!, subscriberHash, {
        tags: [{ name: 'newsletter', status: 'active' }],
      })
      req.payload.logger.info('Newsletter already subscribed', { email, name })

      return data
    }

    console.error('Mailchimp error:', errorBody || err)
    req.payload.logger.error('Mailchimp error', { errorBody, err })
    return data
  }
}
