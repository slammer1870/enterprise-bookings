/**
 * Custom password hashing for Better Auth that supports legacy Payload CMS passwords.
 *
 * Problem: Users created with Payload's built-in auth have passwords stored as
 * PBKDF2-SHA256 (salt + hash in users table). Better Auth uses scrypt by default
 * and stores passwords in the accounts table.
 *
 * Solution: Custom verify function that:
 * 1. First tries scrypt verification (new format)
 * 2. Falls back to PBKDF2 verification (legacy format)
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

/**
 * Verify a password against a legacy Payload PBKDF2 hash.
 * Legacy hashes are stored as "salt:hash" format in the accounts table.
 */
async function verifyLegacyPassword(password: string, legacyHash: string): Promise<boolean> {
  // Legacy hashes are stored as "salt:hash" format
  // Payload stores salt and hash separately in the users table, but we migrate
  // them to the accounts table as "salt:hash"
  
  if (legacyHash.includes(':')) {
    const [salt, hash] = legacyHash.split(':')
    if (salt && hash) {
      try {
        const computedHashRaw = await pbkdf2Promisified(password, salt)
        const computedHash = computedHashRaw.toString('hex')
        return crypto.timingSafeEqual(
          Buffer.from(computedHash, 'hex'),
          Buffer.from(hash, 'hex'),
        )
      } catch {
        return false
      }
    }
  }
  
  return false
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

  // First, try Better Auth's native scrypt verification
  try {
    const isValidScrypt = await betterAuthVerify(data)
    if (isValidScrypt) {
      return true
    }
  } catch {
    // Scrypt verification failed, try legacy format
  }

  // Fall back to legacy PBKDF2 verification
  try {
    const isValidLegacy = await verifyLegacyPassword(password, hash)
    if (isValidLegacy) {
      return true
    }
  } catch {
    // Legacy verification also failed
  }

  return false
}

