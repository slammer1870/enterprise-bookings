'use client'

import React from 'react'
import type { Form } from '@payloadcms/plugin-form-builder/types'

import { FormBlock } from '../../form'

type CustomFormField = {
  name: string
  label: string
  type: string
  required?: boolean
  blockType?: string
  defaultValue?: string
}

export const BruContactBlock: React.FC<{
  title: string
  description: string
  form: Form & {
    fields: CustomFormField[]
  }
}> = ({ title, description, form }) => {
  return (
    <section id="contact" className="z-10 pt-12 pb-0 lg:py-24">
      <div className="w-full lg:flex lg:items-center lg:gap-16">
        <div className="mb-6 lg:mb-0 lg:flex-1">
          <h3 className="mb-2 text-xl font-medium lg:text-3xl">{title}</h3>
          <p className="mb-4 text-gray-700 lg:mb-0 lg:text-lg">{description}</p>
        </div>
        <div className="w-full shrink-0 lg:w-1/3">
          <FormBlock enableIntro={false} form={form} />
        </div>
      </div>
    </section>
  )
}

