import { Block } from 'payload'

export const Contact: Block = {
  slug: 'contact',
  labels: {
    singular: 'Contact Block',
    plural: 'Contact Blocks',
  },
  fields: [
    {
      name: 'locationTitle',
      type: 'text',
      required: true,
      label: 'Location Title',
      defaultValue: 'Our Location',
    },
    {
      name: 'locationDescription',
      type: 'textarea',
      required: true,
      label: 'Location Description',
      defaultValue:
        'We are located on the end of Florence Road, Bray. Just off the main street. We have multiple public parking spaces available on the road to the gym.',
    },
    {
      name: 'mapEmbedUrl',
      type: 'text',
      required: true,
      label: 'Google Maps Embed URL',
      defaultValue:
        'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2389.8115191394754!2d-6.111149684030335!3d53.20329639311717!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4867a9987b9e2e1f%3A0x3551068287b67a29!2sDark%20Horse%20Strength%20%26%20Performance!5e0!3m2!1sen!2sie!4v1651228464827!5m2!1sen!2sie',
    },
    {
      name: 'address',
      type: 'text',
      required: true,
      label: 'Address',
      defaultValue: '17 Main Street, Rear of Bray Co. Wicklow',
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      label: 'Email Address',
      defaultValue: 'info@darkhorsestrength.ie',
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      label: 'Phone Number',
      defaultValue: '087 974 8058',
    },
    {
      name: 'contactTitle',
      type: 'text',
      required: true,
      label: 'Contact Form Title',
      defaultValue: 'Contact Us',
    },
    {
      name: 'contactDescription',
      type: 'textarea',
      required: true,
      label: 'Contact Form Description',
      defaultValue:
        'Do you have any questions? Fill in our contact form and we will get back to you as soon as possible!',
    },
  ],
}
