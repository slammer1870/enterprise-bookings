'use client'

import React from 'react'

import { Footer as FooterType } from '@/payload-types'

export const FooterGlobal: React.FC<{ data: FooterType }> = ({ data: _data }) => {
  return (
    <footer className="bg-gray-100 py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap">
          <div className="w-full">
            <h1 className="text-2xl font-bold text-gray-800">Footer</h1>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default FooterGlobal
