import React from 'react'

/** Fallback when `mapEmbedUrl` is empty in CMS (matches block default). */
const DEFAULT_MAP_EMBED =
  'https://maps.google.com/maps?q=The+Bog+Meadow%2C+Enniskerry%2C+Co.+Wicklow&hl=en&z=15&output=embed'

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
    </svg>
  )
}

export const ClFindSanctuaryBlock: React.FC<{
  heading: string
  address: string
  note?: string | null
  mapEmbedUrl?: string | null
}> = ({ heading, address, note, mapEmbedUrl }) => {
  const src = mapEmbedUrl?.trim() || DEFAULT_MAP_EMBED

  return (
    <section className="w-full bg-[#1a110e] py-16 md:py-28">
      <div className="container mx-auto flex max-w-5xl flex-col items-center px-8 md:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-[2.75rem]">
          {heading}
        </h2>
        <p className="mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-base leading-snug text-[#d4a373] md:text-lg">
          <MapPinIcon className="h-5 w-5 shrink-0 md:h-6 md:w-6" />
          <span>{address}</span>
        </p>
        <div className="mt-10 w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 md:mt-12">
          <iframe
            title={`Map: ${heading}`}
            src={src}
            className="block h-[min(70vw,420px)] w-full min-h-[280px] border-0 md:h-[460px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
        {note ? (
          <p className="mt-6 text-center text-sm text-[#d4a373]/85 md:text-base">{note}</p>
        ) : null}
      </div>
    </section>
  )
}
