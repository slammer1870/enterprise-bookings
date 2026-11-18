export type PasswordFieldState = {
  valid?: boolean
  errorMessage?: unknown
  validate?: unknown
}

type RelaxDispatch = (action: {
  type: 'UPDATE'
  path: string
  valid: true
  errorMessage: undefined
  validate: () => true
}) => void

/** Payload's auth inputs validate as required. Replace that so an empty value can save. */
export function allowBlankPassword(): true {
  return true
}

export function relaxPasswordField(
  dispatch: RelaxDispatch,
  path: string,
  field: PasswordFieldState | undefined,
): void {
  if (!field) return
  if (
    field.valid === true &&
    !field.errorMessage &&
    field.validate === allowBlankPassword
  ) {
    return
  }
  dispatch({
    type: 'UPDATE',
    path,
    valid: true,
    errorMessage: undefined,
    validate: allowBlankPassword,
  })
}
