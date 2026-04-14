import React from 'react'

export const ClSaunaBenefitsBlock: React.FC<{
  sectionTitle: string
  items?: Array<{ title: string; description: string }> | null
}> = ({ sectionTitle, items }) => {
  const list = items?.filter((i) => i?.title && i?.description) ?? []

  return (
    <section className="w-full bg-white py-16 md:py-24">
      <div className="container mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
          {sectionTitle}
        </h2>
        {list.length > 0 ? (
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {list.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-stone-200 bg-stone-50/80 p-6 shadow-sm md:p-8"
              >
                <h3 className="text-lg font-semibold text-stone-900 md:text-xl">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-stone-600 md:text-base">{item.description}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
