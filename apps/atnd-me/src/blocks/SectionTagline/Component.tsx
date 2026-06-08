'use client'

import React from 'react'

interface SectionTaglineBlockProps {
  title: string
  subtitle?: string | null
}

export const SectionTaglineBlock: React.FC<SectionTaglineBlockProps> = ({
  title,
  subtitle,
}) => {
  return (
    <section className="w-full py-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center">{title}</h2>
        {subtitle && (
          <p className="text-muted-foreground text-center mt-2 max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  )
}
