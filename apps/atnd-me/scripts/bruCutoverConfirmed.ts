/** True only after the operator has passed both Bru cutover gates on the command line. */
export function bruCutoverConfirmed(argv: readonly string[]): boolean {
  return argv.includes('--apex-cname-live') && argv.includes('--homepage-rule-removed')
}
