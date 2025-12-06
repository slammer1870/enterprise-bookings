'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    // @ts-ignore
    if (!dialogRef.current?.open) {
      // @ts-ignore
      dialogRef.current?.showModal()
    }
  }, [])

  function onDismiss() {
    router.back()
  }

  if (!isMounted) return null // Prevent rendering on the server

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <dialog
        ref={dialogRef}
        className="relative flex h-auto max-h-[600px] w-4/5 max-w-[400px] rounded-lg border-0 bg-white py-16 font-medium"
        onClose={onDismiss}
      >
        {children}
        <button
          onClick={onDismiss}
          className="absolute right-[10px] top-[10px] flex h-[48px] w-[48px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-xl font-medium hover:bg-gray-200"
        >
          X
        </button>
      </dialog>
    </div>,
    document.getElementById('modal-root')!,
  )
}
