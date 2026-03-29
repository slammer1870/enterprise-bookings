export function getAuthUiBaseURL(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

