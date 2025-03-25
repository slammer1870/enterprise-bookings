'use client'

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
          <h5 className="mb-4 text-3xl font-medium uppercase">{locationTitle}</h5>
          <p className="mb-4 text-gray-700">{locationDescription}</p>
          <div className="relative flex items-end justify-start overflow-hidden rounded-lg bg-gray-300 p-10">
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
            <div className="relative flex flex-wrap rounded bg-white py-6 shadow-md">
              <div className="px-6 lg:w-1/2">
                <h2 className="title-font text-xs font-semibold tracking-widest text-gray-900">
                  ADDRESS
                </h2>
                <p className="mt-1">{address}</p>
              </div>
              <div className="mt-4 px-6 lg:mt-0 lg:w-1/2">
                <h2 className="title-font text-xs font-semibold tracking-widest text-gray-900">
                  EMAIL
                </h2>
                <a className="leading-relaxed text-indigo-500">{email}</a>
                <h2 className="title-font mt-4 text-xs font-semibold tracking-widest text-gray-900">
                  PHONE
                </h2>
                <p className="leading-relaxed">{phone}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="md:w-1/2 md:pl-12 lg:pl-36">
          <h5 className="mb-4 text-3xl font-medium uppercase">{contactTitle}</h5>
          <p className="mb-4 text-gray-700">{contactDescription}</p>
          <form onSubmit={handleSubmit}>
            <div className="-mx-3 mb-4 flex flex-wrap">
              <div className="mb-3 w-full px-3">
                <label
                  className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-700"
                  htmlFor="name"
                >
                  Name
                </label>
                <input
                  className="block w-full appearance-none rounded border border-gray-200 bg-gray-200 py-3 px-4 leading-tight text-gray-700 focus:border-gray-500 focus:bg-white focus:outline-none"
                  id="grid-last-name"
                  type="text"
                  placeholder="Name"
                  name="name"
                  required
                />
              </div>
              <div className="mb-3 w-full px-3 md:mb-0">
                <label
                  className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-700"
                  htmlFor="email"
                >
                  Email
                </label>
                <input
                  className="mb-3 block w-full appearance-none rounded border border-gray-200 bg-gray-200 py-3 px-4 leading-tight text-gray-700 focus:border-gray-500 focus:bg-white focus:outline-none"
                  id="email"
                  type="email"
                  placeholder="Email"
                  name="email"
                  required
                />
              </div>
              <div className="mb-3 w-full px-3">
                <label
                  htmlFor="tel"
                  className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-700"
                >
                  Phone Number <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  type="tel"
                  id="tel"
                  name="tel"
                  placeholder="Phone Number"
                  className="block w-full appearance-none rounded border border-gray-200 bg-gray-200 py-3 px-4 leading-tight text-gray-700 focus:border-gray-500 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="mb-3 w-full px-3">
                <label
                  className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-700"
                  htmlFor="grid-password"
                >
                  Message
                </label>
                <textarea
                  className="mb-3 block w-full appearance-none rounded border border-gray-200 bg-gray-200 py-3 px-4 leading-tight text-gray-700 focus:border-gray-500 focus:bg-white focus:outline-none"
                  rows={4}
                  cols={50}
                  name="message"
                  id="message"
                  placeholder="Message"
                  required
                />
              </div>
              <div className="relative mb-4 px-3">
                <input type="checkbox" id="gdpr" name="gdpr" className="mr-2" required />
                <label className="mt-3 text-xs text-gray-500 lg:text-base">
                  I consent to Dark Horse Strength&apos;s{' '}
                  <span className="underline cursor-pointer" onClick={handleTos}>
                    terms of service
                  </span>
                </label>
              </div>
              <div className="flex w-full pr-4">
                <button className="ml-auto rounded bg-[#FECE7E] px-4 py-2 uppercase text-white">
                  Contact Us
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
