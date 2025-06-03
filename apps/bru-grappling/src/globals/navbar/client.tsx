'use client'

import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

import { Button } from '@repo/ui/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
} from '@repo/ui/components/ui/sheet'

import { Navbar as NavbarType } from '@/payload-types'

export const NavbarGlobal: React.FC<{ data: NavbarType }> = ({ data }) => {
  const [open, setOpen] = useState(false)
  const [scroll, setScroll] = useState(false)

  const handleOpen = () => {
    setOpen(!open)
  }

  const handleScroll = () => {
    setScroll(window.scrollY > 10)
  }

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scroll ? 'bg-white backdrop-blur-sm' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto p-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-medium text-gray-900">
              <h1 className="text-2xl font-medium text-gray-900">BRÚ</h1>
              <span className="sr-only">Logo</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              {data.navigationItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.link}
                  className="text-gray-900 hover:text-gray-600 px-3 py-2 text-sm font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-900 h-min w-min">
                  <Menu />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] pt-12">
                <div className="flex flex-col h-full">
                  {/* Navigation Links */}
                  <nav className="flex flex-col">
                    {data.navigationItems.map((item, index) => (
                      <SheetClose asChild key={index}>
                        <Link
                          href={item.link}
                          className="text-sm text-gray-900 hover:text-gray-600 py-2 transition-colors"
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>

                  {/* Footer content */}
                  <div className="mt-auto pt-6 border-t">
                    <p className="text-sm text-gray-500">
                      © 2024 Your Company. All rights reserved.
                    </p>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}
