'use client'

import React, { useEffect, useState } from 'react'

import Link from 'next/link'

import { usePathname } from 'next/navigation'

import { useAuth } from '@repo/auth/src/providers/auth'

const Navbar: React.FC = () => {
  const [scroll, setScroll] = useState<boolean>(false)
  const [open, setOpen] = useState<boolean>(false)

  const pathname = usePathname()
  const isBrowser: boolean = typeof window !== 'undefined'

  const handleScroll = (): void => {
    if (window.scrollY >= 10 || pathname !== '/') {
      setScroll(true)
    } else {
      setScroll(false)
    }
  }

  if (isBrowser) {
    window.addEventListener('scroll', handleScroll)
  }

  useEffect(() => {
    if (isBrowser) {
      handleScroll()
      window.addEventListener('scroll', handleScroll)

      return () => {
        window.removeEventListener('scroll', handleScroll)
      }
    }
  }, [pathname])

  const { user, status, logout } = useAuth()

  const handleOpen = (): void => {
    setOpen(!open)
  }

  return (
    <nav
      className={`transform ${
        scroll ? `bg-black` : `bg-transparent`
      } fixed z-50 w-full transition-all duration-300 ease-in-out`}
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-2 uppercase md:text-white">
        <Link href="/">
          <img src="/logoBW.svg" alt="Logo" className="h-16" />
        </Link>
        <menu className="flex w-1/3 justify-end md:w-full lg:w-2/3 xl:w-1/2">
          <button className="z-40 md:hidden" onClick={handleOpen}>
            {open ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="30.829"
                height="30.829"
                viewBox="0 0 30.829 30.829"
              >
                <line
                  id="Line_25"
                  data-name="Line 25"
                  x1="39.598"
                  transform="translate(1.414 1.414) rotate(45)"
                  fill="none"
                  stroke="#707070"
                  strokeWidth="3"
                />
                <line
                  id="Line_26"
                  data-name="Line 26"
                  x1="39.598"
                  transform="translate(1.414 29.414) rotate(-45)"
                  fill="none"
                  stroke="#707070"
                  strokeWidth="3"
                />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="34" height="32" viewBox="0 0 34 32">
                <line
                  id="Line_1"
                  data-name="Line 1"
                  x1="34"
                  transform="translate(0 2)"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                />
                <line
                  id="Line_2"
                  data-name="Line 2"
                  x1="34"
                  transform="translate(0 16)"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                />
                <line
                  id="Line_3"
                  data-name="Line 3"
                  x1="34"
                  transform="translate(0 30)"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                />
              </svg>
            )}
          </button>
          <div
            className={`${
              open ? 'block' : 'hidden'
            } absolute top-0 z-20 h-screen w-screen bg-black opacity-50 md:hidden`}
            onClick={handleOpen}
          ></div>
          <div
            className={`transform ${
              open ? '-translate-x-0' : 'translate-x-full'
            } fixed right-0 top-0 z-30 flex h-screen w-1/2 items-start bg-white transition-all duration-300 ease-in-out md:relative md:flex md:h-auto md:w-full md:translate-x-0 md:flex-row md:items-center md:bg-transparent md:py-0`}
          >
            <ul className="mt-20 flex flex-col text-sm font-light md:relative md:mt-0 md:flex md:h-auto md:w-full md:flex-row md:items-center md:justify-end md:bg-transparent md:px-0 md:py-0 md:text-base">
              <Link href="/personal-training">
                <li className="ml-9 mt-4 cursor-pointer md:mt-0 md:ml-16" onClick={handleOpen}>
                  Personal Training
                </li>
              </Link>
              {user ? (
                <Link href="/dashboard">
                  <li
                    className="ml-9 mt-4 cursor-pointer rounded md:mt-0 md:ml-16"
                    onClick={handleOpen}
                  >
                    Dashboard
                  </li>
                </Link>
              ) : (
                <Link href="/dashboard">
                  <li
                    className="ml-9 mt-4 cursor-pointer rounded bg-[#FECE7E] px-2 py-1 text-center text-gray-700 md:mt-0 md:ml-12 md:w-auto"
                    onClick={handleOpen}
                  >
                    Members
                  </li>
                </Link>
              )}
              {user && (
                <li
                  className="ml-9 mt-4 cursor-pointer rounded bg-[#FECE7E] px-2 py-1 text-center text-gray-700 md:mt-0 md:ml-16 md:w-auto"
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

export default Navbar
