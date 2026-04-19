/**
 * Custom password hashing for Better Auth that supports legacy Payload CMS passwords.
 *
 * Problem: Users created with Payload's built-in auth have passwords stored as
 * PBKDF2-SHA256 (salt + hash in users table). Better Auth uses scrypt by default
 * and stores passwords in the accounts table.
 *
 * Solution: Custom verify function that:
 * 1. Tries PBKDF2 first when the stored value matches Payload's legacy shape (avoids scrypt work / edge cases)
 * 2. Otherwise tries scrypt (Better Auth), then PBKDF2 as fallback
 *
 * This allows seamless login for both old and new users without password resets.
 *
 * @see https://www.better-auth.com/docs/authentication/email-password#configuration
 */

import * as crypto from 'crypto'
import { hashPassword as betterAuthHash, verifyPassword as betterAuthVerify } from 'better-auth/crypto'

/**
 * PBKDF2 verification for legacy Payload CMS passwords.
 * Parameters match Payload's default: SHA-256, 25000 iterations, 512-byte output.
 */
function pbkdf2Promisified(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.pbkdf2(password, salt, 25000, 512, 'sha256', (err, hashRaw) =>
      err ? reject(err) : resolve(hashRaw),
    ),
  )
}

/** Split only on the first ':' so a malformed or future format cannot truncate the hash segment. */
function splitSaltHashPrefix(value: string): { salt: string; hashHex: string } | null {
  const i = value.indexOf(':')
  if (i <= 0 || i >= value.length - 1) return null
  const salt = value.slice(0, i)
  const hashHex = value.slice(i + 1)
  if (!salt || !hashHex) return null
  return { salt, hashHex }
}

/**
 * Payload default PBKDF2 migration format: 32-byte salt as 64 hex chars, 512-byte hash as 1024 hex chars.
 * Better Auth scrypt uses a 16-byte salt (32 hex) and 64-byte key (128 hex) after the colon.
 */
function looksLikePayloadLegacyPbkdf2SaltHash(value: string): boolean {
  const parts = splitSaltHashPrefix(value)
  if (!parts) return false
  const { salt, hashHex } = parts
  if (salt.length !== 64 || hashHex.length !== 1024) return false
  return /^[0-9a-f]+$/i.test(salt) && /^[0-9a-f]+$/i.test(hashHex)
}

/**
 * Verify a password against a legacy Payload PBKDF2 hash.
 * Legacy hashes are stored as "salt:hash" format in the accounts table.
 */
async function verifyLegacyPassword(password: string, legacyHash: string): Promise<boolean> {
  const parts = splitSaltHashPrefix(legacyHash)
  if (!parts) return false

  const { salt, hashHex } = parts
  try {
    const computedHashRaw = await pbkdf2Promisified(password, salt)
    const computedHash = computedHashRaw.toString('hex')
    const a = Buffer.from(computedHash, 'hex')
    const b = Buffer.from(hashHex, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(new Uint8Array(a), new Uint8Array(b))
  } catch {
    return false
  }
}

/**
 * Custom password hash function.
 * Uses Better Auth's default scrypt hashing for new passwords.
 */
export async function hashPassword(password: string): Promise<string> {
  return betterAuthHash(password)
}

/**
 * Custom password verify function that supports both:
 * 1. New scrypt hashes (Better Auth default)
 * 2. Legacy PBKDF2 hashes (Payload CMS format: "salt:hash")
 *
 * For legacy passwords to work, you need to migrate the salt:hash from the users
 * table to the accounts table's password field in format "salt:hash".
 */
export async function verifyPassword(data: { password: string; hash: string }): Promise<boolean> {
  const { password, hash } = data

  const tryScrypt = async (): Promise<boolean> => {
    try {
      return await betterAuthVerify(data)
    } catch {
      return false
    }
  }

  const tryLegacy = (): Promise<boolean> => verifyLegacyPassword(password, hash)

  if (looksLikePayloadLegacyPbkdf2SaltHash(hash)) {
    if (await tryLegacy()) return true
    if (await tryScrypt()) return true
    return false
  }

  if (await tryScrypt()) return true
  if (await tryLegacy()) return true
  return false
}

