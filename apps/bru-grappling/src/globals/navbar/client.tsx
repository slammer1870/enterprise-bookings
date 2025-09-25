'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@repo/auth'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@repo/ui/components/ui/button'

import { Navbar as NavbarType } from '@/payload-types'

export const NavbarGlobal: React.FC<{ data: NavbarType }> = ({ data }) => {
  const [scroll, setScroll] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const isBrowser = typeof window !== 'undefined'

  const handleScroll = useCallback(() => {
    // Safety check for window object to prevent client-side errors during SSR/hydration
    if (typeof window === 'undefined') return

    if (window.scrollY >= 10 || pathname !== '/') {
      setScroll(true)
    } else {
      setScroll(false)
    }
  }, [pathname])

  useEffect(() => {
    if (isBrowser) {
      handleScroll()
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [router, handleScroll, isBrowser])

  const handleOpen = () => {
    setOpen(!open)
  }

  return (
    <nav
      className={`transform ${
        scroll ? `bg-white` : `bg-transparent`
      } fixed z-20 w-full transition-all duration-300 ease-in-out`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="container mx-auto flex items-center justify-between p-4 text-gray-900">
        <Link
          href="/"
          className="text-2xl font-medium text-black hover:cursor-pointer focus:outline-none rounded"
          aria-label="Go to homepage"
        >
          <h1>{data?.logo || 'BRÚ'}</h1>
        </Link>
        <div className="flex w-1/3 justify-end lg:w-full">
          <button
            className="z-40 lg:hidden p-2 rounded focus:outline-none"
            onClick={handleOpen}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {open ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 30.829 30.829"
                className="h-6 w-6"
                aria-hidden="true"
                focusable="false"
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
                aria-hidden="true"
                focusable="false"
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
          {/* Mobile menu overlay */}
          <div
            className={`${
              open ? 'block' : 'hidden'
            } absolute top-0 z-20 h-screen w-screen bg-black opacity-50 lg:hidden`}
            onClick={handleOpen}
            aria-hidden="true"
          ></div>
          <div
            id="mobile-menu"
            className={`transform ${
              open ? '-translate-x-0' : 'translate-x-full'
            } fixed right-0 top-0 bg-white z-30 flex h-screen w-1/2 items-start transition-all duration-300 ease-in-out md:w-1/4 lg:relative lg:flex lg:h-auto lg:w-11/12 lg:translate-x-0 lg:flex-row lg:items-center lg:bg-transparent lg:py-0 xl:w-full`}
            aria-hidden={!open ? 'true' : 'false'}
          >
            <ul
              className="mt-20 flex flex-col pr-6 text-sm lg:relative lg:mt-0 lg:h-auto lg:w-full lg:flex-row lg:items-center lg:justify-end lg:bg-transparent lg:px-0 lg:py-0 lg:pr-0 lg:text-base"
              role="list"
            >
              {data?.navigationItems?.map((item: any, index: number) =>
                item.isExternal ? (
                  <li key={index} role="listitem">
                    <a
                      href={item.link}
                      className="ml-9 mt-4 cursor-pointer lg:ml-20 lg:mt-0 block p-2 rounded hover:bg-gray-100 focus:outline-none"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${item.label} (opens in new tab)`}
                    >
                      {item.label}
                    </a>
                  </li>
                ) : (
                  <li key={index} role="listitem">
                    <Link
                      href={item.link}
                      className="ml-9 mt-4 cursor-pointer lg:ml-20 lg:mt-0 block p-2 rounded hover:bg-gray-100 focus:outline-none"
                      onClick={handleOpen}
                    >
                      {item.label}
                    </Link>
                  </li>
                ),
              )}
              {user && (
                <li role="listitem">
                  <Link
                    href="/dashboard"
                    className="ml-9 mt-4 cursor-pointer lg:mt-0 lg:ml-20 block p-2 rounded hover:bg-gray-100 focus:outline-none"
                    onClick={handleOpen}
                  >
                    Dashboard
                  </Link>
                </li>
              )}
              {!user && (
                <li className="ml-9 mt-4 lg:mt-0 lg:ml-20" role="listitem">
                  <Button
                    asChild
                    variant="secondary"
                    onClick={handleOpen}
                    className="focus:outline-none"
                  >
                    <Link href="/login">Members</Link>
                  </Button>
                </li>
              )}
              {user && (
                <li className="ml-9 mt-4 lg:mt-0 lg:ml-20" role="listitem">
                  <Button
                    variant="default"
                    className="bg-[#FECE7E] text-gray-700 hover:bg-[#FECE7E]/90 focus:outline-none"
                    onClick={() => logout().then(() => router.push('/'))}
                    aria-label="Logout from your account"
                  >
                    Logout
                  </Button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default NavbarGlobal
