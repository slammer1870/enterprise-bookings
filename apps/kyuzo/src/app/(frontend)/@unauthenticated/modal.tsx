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
    if (!dialogRef.current?.open) {
      dialogRef.current?.showModal()
    }
  }, [])

  function onDismiss() {
    router.back()
  }

  if (!isMounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <dialog
        ref={dialogRef}
        className="relative flex h-auto max-h-[80vh] w-11/12 max-w-[520px] rounded-lg border-0 bg-white p-6"
        onClose={onDismiss}
      >
        {children}
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-lg font-medium hover:bg-gray-100"
          aria-label="Close"
        >
          ×
        </button>
      </dialog>
    </div>,
    document.getElementById('modal-root')!,
  )
}


