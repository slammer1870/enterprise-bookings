import React from 'react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText } from '@payloadcms/richtext-lexical/react'

export const ClMissionBlock: React.FC<{
  heading: string
  lede?: string | null
  body?: SerializedEditorState | null
}> = ({ heading, lede, body }) => {
  return (
    <section className="w-full bg-white py-16 md:py-24">
      <div className="container mx-auto max-w-3xl px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
          {heading}
        </h2>
        {lede ? (
          <p className="mx-auto mt-8 max-w-2xl text-center text-lg text-stone-700 md:text-xl">{lede}</p>
        ) : null}
        {body ? (
          <RichText
            data={body}
            className="prose prose-stone mx-auto mt-10 max-w-2xl prose-p:text-stone-700 prose-p:leading-relaxed md:prose-p:text-lg"
          />
        ) : null}
      </div>
    </section>
  )
}
