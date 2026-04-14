import React from 'react'

export const ClFindSanctuaryBlock: React.FC<{
  heading: string
  address: string
  note?: string | null
}> = ({ heading, address, note }) => {
  return (
    <section className="w-full bg-stone-100 py-16 md:py-24">
      <div className="container mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">{heading}</h2>
        <p className="mt-6 text-lg text-stone-700 md:text-xl">{address}</p>
        {note ? <p className="mt-4 text-base text-stone-600">{note}</p> : null}
      </div>
    </section>
  )
}
