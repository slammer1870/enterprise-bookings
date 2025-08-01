'use client'

import React from 'react'
import Link from 'next/link'

import { Footer as FooterType } from '@/payload-types'

export const FooterGlobal: React.FC<{ data: FooterType }> = ({ data }) => {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="text-gray-600 body-font">
      <div className="w-full px-4 py-8 mx-auto flex items-center sm:flex-row flex-col">
        <Link
          href="/"
          className="flex title-font font-medium items-center md:justify-start justify-center text-gray-900"
        >
          <span className="ml-3 text-xl">{data.brandName}</span>
        </Link>
        <p className="text-sm text-gray-500 sm:ml-4 sm:pl-4 sm:border-l-2 sm:border-gray-200 sm:py-2 sm:mt-0 mt-4">
          © {currentYear} {data.copyrightText} —
          {data.socialLinks?.twitter && (
            <a
              href={data.socialLinks.twitter}
              className="text-gray-600 ml-1"
              rel="noopener noreferrer"
              target="_blank"
            >
              @kyuzo
            </a>
          )}
        </p>
        <span className="inline-flex sm:ml-auto sm:mt-0 mt-4 justify-center sm:justify-start">
          {data.socialLinks?.facebook && (
            <a
              href={data.socialLinks.facebook}
              className="text-gray-500"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg
                fill="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="w-5 h-5"
                viewBox="0 0 24 24"
              >
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"></path>
              </svg>
            </a>
          )}
          {data.socialLinks?.twitter && (
            <a
              href={data.socialLinks.twitter}
              className="text-gray-500 ml-3"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg
                fill="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="w-5 h-5"
                viewBox="0 0 24 24"
              >
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"></path>
              </svg>
            </a>
          )}
          {data.socialLinks?.instagram && (
            <a
              href={data.socialLinks.instagram}
              className="text-gray-500 ml-3"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="w-5 h-5"
                viewBox="0 0 24 24"
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01"></path>
              </svg>
            </a>
          )}
          {data.socialLinks?.youtube && (
            <a
              href={data.socialLinks.youtube}
              className="text-gray-500 ml-3"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="w-5 h-5"
                viewBox="0 0 27 18"
              >
                <rect
                  id="Rectangle_32"
                  data-name="Rectangle 32"
                  width="27"
                  height="18"
                  rx="5"
                  fill="#6c727f"
                />
                <path
                  id="Polygon_1"
                  data-name="Polygon 1"
                  d="M5,0l5,9H0Z"
                  transform="translate(19 4) rotate(90)"
                  fill="#fff"
                />
              </svg>
            </a>
          )}
        </span>
      </div>
    </footer>
  )
}

export default FooterGlobal
