'use client'

import React, { useEffect } from 'react'
import { toast } from '@payloadcms/ui'

import {
  fileListHasOversizedMedia,
  getMediaUploadSizeError,
} from '@/lib/media/upload-limits'

/**
 * Admin-wide guard: reject oversized image files on select/drop before Payload
 * starts the multipart upload. Without this, abortOnLimit only responds after
 * the full body is drained — which looks like a stuck loading state in production.
 */
export function MediaUploadSizeGuard({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    const rejectIfOversized = (
      files: FileList | File[] | null | undefined,
      event: Event,
    ): boolean => {
      if (!fileListHasOversizedMedia(files)) return false
      event.preventDefault()
      event.stopImmediatePropagation()
      toast.error(getMediaUploadSizeError())
      return true
    }

    const onChange = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.type !== 'file') return
      if (!rejectIfOversized(target.files, event)) return
      target.value = ''
    }

    const onDrop = (event: DragEvent) => {
      rejectIfOversized(event.dataTransfer?.files, event)
    }

    document.addEventListener('change', onChange, true)
    document.addEventListener('drop', onDrop, true)
    return () => {
      document.removeEventListener('change', onChange, true)
      document.removeEventListener('drop', onDrop, true)
    }
  }, [])

  return <>{children}</>
}

export default MediaUploadSizeGuard
