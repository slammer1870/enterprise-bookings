'use client'

import React from 'react'

interface HealthBenefitsBlockProps {
  sectionTitle: string
  items: Array<{ title: string; description: string }>
}

export const HealthBenefitsBlock: React.FC<HealthBenefitsBlockProps> = ({
  sectionTitle,
  items,
}) => {
  return (
    <section className="w-full py-12">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">{sectionTitle}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {items?.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
            >
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
