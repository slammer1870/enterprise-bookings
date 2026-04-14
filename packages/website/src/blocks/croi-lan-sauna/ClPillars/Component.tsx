import React from 'react'

export const ClPillarsBlock: React.FC<{
  items?: Array<{ label: string }> | null
}> = ({ items }) => {
  const pillars = items?.length ? items : [{ label: 'Release.' }, { label: 'Relax.' }, { label: 'Recover.' }]

  return (
    <section className="w-full border-y border-stone-200 bg-stone-50 py-10">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center justify-center gap-6 text-center sm:flex-row sm:gap-12 md:gap-20">
          {pillars.map((p, i) => (
            <p key={i} className="text-xl font-medium tracking-wide text-stone-800 md:text-2xl">
              {p.label}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
