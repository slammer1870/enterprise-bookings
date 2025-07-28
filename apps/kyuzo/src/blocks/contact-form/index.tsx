import React from 'react'

import type { Form } from '@payloadcms/plugin-form-builder/types'
import { FormBlock } from '@repo/website/src/blocks/form/index'

type ContactFormProps = {
  heading: string
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

export const ContactFormBlock: React.FC<ContactFormProps> = ({
  heading,
  description,
  form,
}) => {
  return (
    <section className="text-white bg-[#E73F43]">
      <div className="py-20 lg:mx-52 flex flex-col items-start justify-center max-w-md md:max-w-full mx-auto md:flex-row md:items-center md:justify-around px-4">
        <div className="mb-4 md:mb-0 md:pr-8">
          <h3 className="text-xl md:text-2xl lg:text-3xl">{heading}</h3>
          <p className="mb-1 font-light md:text-lg lg:text-2xl lg:text-gray-100">
            {description}
          </p>
        </div>
        <div className="w-full max-w-md lg:max-w-lg">
          <FormBlock enableIntro={false} form={form} />
        </div>
      </div>
    </section>
  )
} 