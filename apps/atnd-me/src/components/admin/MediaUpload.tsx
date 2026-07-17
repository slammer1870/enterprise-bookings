'use client'

import React, { useCallback } from 'react'
import { toast, Upload, useDocumentInfo, useField } from '@payloadcms/ui'

import {
  getMediaUploadSizeError,
  isOversizedMediaFile,
  MEDIA_MAX_FILE_SIZE_LABEL,
} from '@/lib/media/upload-limits'

/**
 * Media edit Upload with immediate client-side size feedback (incl. paste-URL path).
 * Complements MediaUploadSizeGuard for select/drop across admin.
 */
export function MediaUpload() {
  const { collectionSlug, docConfig, initialState } = useDocumentInfo()
  const { setValue } = useField<File | null>({ path: 'file' })

  const onChange = useCallback(
    (file?: File) => {
      if (file && isOversizedMediaFile(file)) {
        toast.error(getMediaUploadSizeError())
        setValue(null)
        return
      }
    },
    [setValue],
  )

  if (!collectionSlug || !docConfig || !('upload' in docConfig) || !docConfig.upload) {
    return null
  }

  return (
    <div>
      <p
        style={{
          color: 'var(--theme-elevation-600)',
          fontSize: '0.875rem',
          margin: '0 0 0.75rem',
        }}
      >
        Maximum upload file size: {MEDIA_MAX_FILE_SIZE_LABEL}. Recommended for images:{' '}
        &lt;500KB.
      </p>
      <Upload
        collectionSlug={collectionSlug}
        initialState={initialState}
        onChange={onChange}
        uploadConfig={docConfig.upload}
      />
    </div>
  )
}

export default MediaUpload
