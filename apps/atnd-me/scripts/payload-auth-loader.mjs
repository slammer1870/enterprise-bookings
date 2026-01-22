/**
 * Node ESM loader to make `payload-auth`'s published ESM output work in Node.
 *
 * `payload-auth` ships ESM with extensionless and directory specifiers like:
 *   import "./helpers/foo"
 *   export * from "./adapter"
 *
 * Node's ESM resolver requires explicit extensions and does not support directory imports.
 *
 * This loader adds *minimal* compatibility for:
 * - extensionless relative/directory specifiers used by `payload-auth`
 * - extensionless Next.js subpath imports like `next/headers` (Node needs `next/headers.js`)
 *
 * Enabled via NODE_OPTIONS:
 *   --experimental-loader ./scripts/payload-auth-loader.mjs
 */
export async function resolve(specifier, context, nextResolve) {
  // First try default resolver.
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const parentURL = context?.parentURL ?? "";
    const isFromPayloadAuth = parentURL.includes("/payload-auth/");

    // Only try to fix relative/absolute specifiers (for payload-auth)
    // or well-known package subpath imports like `next/headers`.
    const isRelativeOrAbsolute =
      specifier.startsWith("./") ||
      specifier.startsWith("../") ||
      specifier.startsWith("/") ||
      specifier.startsWith("file:");

    const isBareSubpath = !isRelativeOrAbsolute && specifier.includes("/");

    // Keep query/hash intact.
    const [base, suffix = ""] = specifier.split(/(?=[?#])/);

    // If it already has an extension, don't try to change it.
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(base);
    if (hasExtension) throw err;

    // 1) Fix payload-auth's relative + directory specifiers.
    if (isFromPayloadAuth && isRelativeOrAbsolute) {
      const candidates = [
        `${base}.js${suffix}`,
        `${base}.mjs${suffix}`,
        `${base}.cjs${suffix}`,
        `${base}/index.js${suffix}`,
        `${base}/index.mjs${suffix}`,
        `${base}/index.cjs${suffix}`,
      ];

      for (const candidate of candidates) {
        try {
          return await nextResolve(candidate, context);
        } catch {
          // try next
        }
      }
    }

    // 2) Fix Next.js subpath imports when Node requires an extension (e.g. `next/headers`).
    // Only attempt for bare *subpaths* (leave bare package roots alone).
    if (isBareSubpath) {
      const candidates = [
        `${base}.js${suffix}`,
        `${base}.mjs${suffix}`,
        `${base}.cjs${suffix}`,
        `${base}/index.js${suffix}`,
        `${base}/index.mjs${suffix}`,
        `${base}/index.cjs${suffix}`,
      ];
      for (const candidate of candidates) {
        try {
          return await nextResolve(candidate, context);
        } catch {
          // try next
        }
      }
    }

    throw err;
  }
}

