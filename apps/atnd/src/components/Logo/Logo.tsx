import React from 'react'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (_props: Props) => {
  return <h1 className="text-2xl font-bold">ATND</h1>
}
