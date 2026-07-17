/** Max upload size for media (matches SEO plugin field copy). */
export const MEDIA_MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024

export const MEDIA_MAX_FILE_SIZE_LABEL = '12MB'

export function getMediaUploadSizeError(): string {
  return `File exceeds the ${MEDIA_MAX_FILE_SIZE_LABEL} upload limit.`
}

/** True when a File should be rejected by Media upload size rules. */
export function isOversizedMediaFile(file: File): boolean {
  if (!(file instanceof File)) return false
  // Media only accepts images; also treat unknown mime as image-like (browser quirks).
  const isImageLike = !file.type || file.type.startsWith('image/')
  return isImageLike && file.size > MEDIA_MAX_FILE_SIZE_BYTES
}

export function fileListHasOversizedMedia(
  files: FileList | File[] | null | undefined,
): boolean {
  if (!files?.length) return false
  return Array.from(files).some(isOversizedMediaFile)
}
