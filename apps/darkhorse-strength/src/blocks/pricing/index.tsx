import React from 'react'

type PricingOption = {
  title: string
  price: string
  features: string[]
  note: string
}

type PricingProps = {
  title: string
  description: string
  pricingOptions: PricingOption[]
}

export const PricingBlock: React.FC<PricingProps> = ({
  title = 'Pricing',
  description = 'We have a range of options to suit your budget and schedule.',
  pricingOptions = [],
}) => {
  return (
    <section className="body-font text-gray-600">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-4 flex w-full flex-col text-left">
          <h1 className="mb-2 text-3xl font-medium uppercase text-gray-900">{title}</h1>
          <p className="text-base leading-relaxed lg:w-2/3">{description}</p>
        </div>
        <div className="mx-auto w-full overflow-auto">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {pricingOptions.map((option, index) => (
              <div key={index} className="col-span-1 w-full rounded-md border">
                <div className="relative flex h-full flex-col overflow-hidden rounded p-6">
                  <h2 className="title-font mb-1 text-xl font-medium tracking-widest">
                    {option.title}
                  </h2>
                  <h1 className="mb-4 border-b border-gray-200 pb-4 text-4xl leading-none text-gray-900">
                    {option.price}
                  </h1>
                  {option.features.map((feature, idx) => (
                    <p key={idx} className="mb-2 flex items-center text-gray-600">
                      <span className="mr-2 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-gray-400 text-white">
                        <svg
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          className="h-3 w-3"
                          viewBox="0 0 24 24"
                        >
                          <path d="M20 6L9 17l-5-5"></path>
                        </svg>
                      </span>
                      {feature}
                    </p>
                  ))}
                  <p className="mt-3 text-xs text-gray-500">{option.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
