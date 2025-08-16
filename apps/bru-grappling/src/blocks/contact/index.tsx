import React from 'react'

import { FormBlock } from '@repo/website/src/blocks/form'
import type { Form } from '@payloadcms/plugin-form-builder/types'

type Props = {
  title: string
  description: string
  form: Form & {
    fields: Array<{
      name: string
      label: string
      type: string
      required?: boolean
      blockType?: string
      defaultValue?: string
    }>
  }
}

export const Contact: React.FC<Props> = ({ title, description, form }) => {
  return (
    <section id="contact" className="z-10 py-20 lg:py-24">
      <div className="container mx-auto px-4 lg:flex lg:items-center lg:justify-between">
        <div className="mb-8">
          <h3 className="mb-2 text-xl font-medium lg:text-3xl">{title}</h3>
          <p className="mb-4 text-gray-700 lg:text-lg">{description}</p>
        </div>
        <FormBlock enableIntro={false} form={form} />
      </div>
    </section>
  )
}
