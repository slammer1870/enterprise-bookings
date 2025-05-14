'use client'

import { FormBlock } from '@repo/website/src/blocks/form'
import React, { useState } from 'react'

type ContactProps = {
  locationTitle: string
  locationDescription: string
  mapEmbedUrl: string
  address: string
  email: string
  phone: string
  contactTitle: string
  contactDescription: string
  form: any
}

export const ContactBlock: React.FC<ContactProps> = ({
  locationTitle = 'Our Location',
  locationDescription = 'We are located on the end of Florence Road, Bray. Just off the main street. We have multiple public parking spaces available on the road to the gym.',
  mapEmbedUrl = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2389.8115191394754!2d-6.111149684030335!3d53.20329639311717!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4867a9987b9e2e1f%3A0x3551068287b67a29!2sDark%20Horse%20Strength%20%26%20Performance!5e0!3m2!1sen!2sie!4v1651228464827!5m2!1sen!2sie',
  address = '17 Main Street, Rear of Bray Co. Wicklow',
  email = 'info@darkhorsestrength.ie',
  phone = '087 974 8058',
  contactTitle = 'Contact Us',
  contactDescription = 'Do you have any questions? Fill in our contact form and we will get back to you as soon as possible!',
  form,
}) => {
  const [tos, setTos] = useState(false)

  const handleTos = () => {
    setTos(!tos)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log('Form submitted')
  }

  return (
    <>
      <div className="container mx-auto flex flex-wrap px-4 py-12 sm:flex-nowrap">
        <div className="mb-24 md:w-1/2">
          <h5 className="mb-4 text-3xl font-medium">{locationTitle}</h5>
          <p className="mb-4 text-muted-foreground">{locationDescription}</p>
          <div className="relative flex items-end justify-start overflow-hidden rounded-lg bg-muted p-10">
            <iframe
              width="100%"
              height="100%"
              className="absolute inset-0"
              frameBorder={0}
              title="map"
              marginHeight={0}
              marginWidth={0}
              scrolling="no"
              src={mapEmbedUrl}
              style={{ filter: ' contrast(1.2) opacity(0.4)' }}
            />
            <div className="relative flex flex-wrap rounded bg-background py-6 shadow-md">
              <div className="px-6 lg:w-1/2">
                <h2 className="title-font text-xs font-semibold tracking-widest text-foreground">
                  ADDRESS
                </h2>
                <p className="mt-1">{address}</p>
              </div>
              <div className="mt-4 px-6 lg:mt-0 lg:w-1/2">
                <h2 className="title-font text-xs font-semibold tracking-widest text-foreground">
                  EMAIL
                </h2>
                <a className="leading-relaxed text-primary">{email}</a>
                <h2 className="title-font mt-4 text-xs font-semibold tracking-widest text-foreground">
                  PHONE
                </h2>
                <p className="leading-relaxed">{phone}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="md:w-1/2 md:pl-12 lg:pl-36">
          <h5 className="mb-4 text-3xl font-medium">{contactTitle}</h5>
          <p className="mb-4 text-muted-foreground">{contactDescription}</p>
          <FormBlock enableIntro={false} form={form} />
        </div>
      </div>
    </>
  )
}
