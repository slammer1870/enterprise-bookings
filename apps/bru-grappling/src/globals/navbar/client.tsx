'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@repo/auth/src/providers/auth'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { Navbar as NavbarType } from '@/payload-types'

export const NavbarGlobal: React.FC<{ data: NavbarType }> = ({ data }) => {
  const [scroll, setScroll] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const isBrowser = typeof window !== 'undefined'

  const handleScroll = () => {
    if (window.scrollY >= 10 || pathname !== '/') {
      setScroll(true)
    } else {
      setScroll(false)
    }
  }

  useEffect(() => {
    if (isBrowser) {
      handleScroll()
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [router])

  const handleOpen = () => {
    setOpen(!open)
  }

  return (
    <nav
      className={`transform ${
        scroll ? `bg-white` : `bg-transparent`
      } fixed z-20 w-full transition-all duration-300 ease-in-out`}
    >
      <div className="container mx-auto flex items-center justify-between p-4 text-gray-900">
        <Link href="/">
          <h1 className="text-2xl font-medium text-black hover:cursor-pointer">
            {data?.logo || 'BRÚ'}
          </h1>
        </Link>
        <menu className="flex w-1/3 justify-end lg:w-full">
          <button className="z-40 lg:hidden" onClick={handleOpen}>
            {open ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 30.829 30.829"
                className="h-6 w-6"
              >
                <line
                  id="Line_25"
                  data-name="Line 25"
                  x1="39.598"
                  transform="translate(1.414 1.414) rotate(45)"
                  fill="none"
                  stroke="#000"
                  strokeWidth="3"
                />
                <line
                  id="Line_26"
                  data-name="Line 26"
                  x1="39.598"
                  transform="translate(1.414 29.414) rotate(-45)"
                  fill="none"
                  stroke="#000"
                  strokeWidth="3"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 39.471 28.5"
                className="h-6 w-auto"
              >
                <line
                  id="Line_1"
                  data-name="Line 1"
                  x1="31.397"
                  transform="translate(0 13.75)"
                  fill="none"
                  stroke="#000"
                  strokeWidth="3"
                />
                <line
                  id="Line_2"
                  data-name="Line 2"
                  x1="39.471"
                  transform="translate(0 1.5)"
                  fill="none"
                  stroke="#000"
                  strokeWidth="3"
                />
                <line
                  id="Line_3"
                  data-name="Line 3"
                  x1="26.015"
                  transform="translate(0 27)"
                  fill="none"
                  stroke="#000"
                  strokeWidth="3"
                />
              </svg>
            )}
          </button>
          <div
            className={`${
              open ? 'block' : 'hidden'
            } absolute top-0 z-20 h-screen w-screen bg-black opacity-50 lg:hidden`}
            onClick={handleOpen}
          ></div>
          <div
            className={`transform ${
              open ? '-translate-x-0' : 'translate-x-full'
            } fixed right-0 top-0 z-30 flex h-screen w-1/2 items-start transition-all duration-300 ease-in-out md:w-1/4 lg:relative lg:flex lg:h-auto lg:w-11/12 lg:translate-x-0 lg:flex-row lg:items-center lg:bg-transparent lg:py-0 xl:w-full`}
          >
            <ul className="mt-20 flex flex-col pr-6 text-sm lg:relative lg:mt-0 lg:h-auto lg:w-full lg:flex-row lg:items-center lg:justify-end lg:bg-transparent lg:px-0 lg:py-0 lg:pr-0 lg:text-base">
              {data?.navigationItems?.map((item: any, index: number) =>
                item.isExternal ? (
                  <a
                    key={index}
                    href={item.link}
                    className="ml-9 mt-4 cursor-pointer lg:ml-20 lg:mt-0"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link key={index} href={item.link}>
                    <li className="ml-9 mt-4 cursor-pointer lg:ml-20 lg:mt-0" onClick={handleOpen}>
                      {item.label}
                    </li>
                  </Link>
                ),
              )}
              {user && (
                <Link href="/dashboard">
                  <li className="ml-9 mt-4 cursor-pointer lg:mt-0 lg:ml-20" onClick={handleOpen}>
                    Dashboard
                  </li>
                </Link>
              )}
              {!user && (
                <Link href="/#contact">
                  <li
                    className="ml-9 mt-4 cursor-pointer bg-gray-200 px-4 py-1 text-center text-gray-900 lg:mt-0 lg:ml-20 lg:w-auto"
                    onClick={handleOpen}
                  >
                    Contact
                  </li>
                </Link>
              )}
              {user && (
                <li
                  className="ml-9 mt-4 cursor-pointer bg-[#FECE7E] px-3 py-1 text-center text-gray-700 lg:mt-0 lg:ml-20 lg:w-auto"
                  onClick={() => logout()}
                >
                  Logout
                </li>
              )}
            </ul>
          </div>
        </menu>
      </div>
    </nav>
  )
}

export default NavbarGlobal
