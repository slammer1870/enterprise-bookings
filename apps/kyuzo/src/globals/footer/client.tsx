'use client'

import React from 'react'

import { Footer as FooterType } from '@/payload-types'

export const FooterGlobal: React.FC<{ data: FooterType }> = ({ data: _data }) => {
  return (
    <footer>
      <div className="container">
        <div className="row">
          <div className="col-12">
            <h1>Footer</h1>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default FooterGlobal
