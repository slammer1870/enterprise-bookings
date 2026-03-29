import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

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
  const parentURL = context?.parentURL ?? "";
  // Be tolerant of pnpm store paths like `.../.pnpm/payload-auth@.../` where the
  // segment isn't followed by `/payload-auth/` exactly.
  const isFromPayloadAuth = parentURL.includes("/payload-auth");
  const isRelativeOrAbsolute =
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:");
  const isBareSubpath = !isRelativeOrAbsolute && specifier.includes("/");
  const [base, suffix = ""] = specifier.split(/(?=[?#])/);
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(base);

  // 1) For payload-auth relative/directory specifiers: resolve to a real file URL and
  //    short-circuit. Node's default resolver turns "./adapter" into a directory URL and
  //    then throws "Directory import is not supported" before our hook can fix it, so we
  //    must resolve relative to parent ourselves and return that URL.
  if (isFromPayloadAuth && isRelativeOrAbsolute && !hasExtension) {
    try {
      const parentPath = fileURLToPath(parentURL);
      const parentDir = path.dirname(parentPath);
      const candidates = [
        path.join(parentDir, base, "index.js"),
        path.join(parentDir, base, "index.mjs"),
        path.join(parentDir, base + ".js"),
        path.join(parentDir, base + ".mjs"),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          // We are intentionally bypassing Node's default resolver for this specifier.
          // `shortCircuit: true` is required on newer Node versions.
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    } catch {
      // fall through to default
    }
  }

  // 2) Default resolution, and fallback for other cases (e.g. Next.js subpath).
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (hasExtension) throw err;
    // Fix payload-auth extensionless (when directory candidates above didn't match).
    if (isFromPayloadAuth && isRelativeOrAbsolute) {
      const candidates = [
        `${base}.js${suffix}`,
        `${base}.mjs${suffix}`,
        `${base}/index.js${suffix}`,
        `${base}/index.mjs${suffix}`,
      ];
      for (const candidate of candidates) {
        try {
          return await nextResolve(candidate, context);
        } catch {
          // try next
        }
      }
    }
    if (isBareSubpath) {
      const candidates = [
        `${base}.js${suffix}`,
        `${base}.mjs${suffix}`,
        `${base}/index.js${suffix}`,
        `${base}/index.mjs${suffix}`,
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

