// Not a public export. This is the function Payload uses to turn an error thrown during a save
// or delete into the response body the admin toast reads, so going through it shows what the
// admin sees.
import { routeError } from '../../node_modules/payload/dist/utilities/routeError.js'

export type AdminToast = { status: number; messages: string[] }

type Hook = (_args: never) => unknown

/** What the admin toast is given when a save or delete throws `err`. */
export async function adminToastFor(err: unknown): Promise<AdminToast> {
  const payload = {
    // Production config: `debug` is off, so Payload hides the message of any non-public error.
    config: { debug: false, hooks: {}, loggingLevels: {} },
    logger: { error() {}, info() {}, warn() {} },
  }
  const req = { context: {}, headers: new Headers(), payload }

  const response = await routeError({
    collection: undefined,
    config: payload.config,
    err,
    req,
  } as never)
  const body = (await response.json()) as { errors: { message: string }[] }

  return { status: response.status, messages: body.errors.map((error) => error.message) }
}

/** The toast for a save or delete that is refused, or `null` when it goes through. */
export async function refusalToast(run: () => unknown): Promise<AdminToast | null> {
  try {
    await run()
    return null
  } catch (err) {
    return adminToastFor(err)
  }
}

/**
 * Runs hooks in order as Payload does, feeding each hook's result to the next.
 * Collection hooks carry `data`; field hooks carry `value`.
 */
export async function runHooks(
  hooks: unknown,
  args: Record<string, unknown>,
  carry: 'data' | 'value' = 'data',
): Promise<unknown> {
  let current = args[carry]
  for (const hook of (hooks ?? []) as Hook[]) {
    const next = await hook({ ...args, [carry]: current } as never)
    if (next !== undefined) current = next
  }
  return current
}
