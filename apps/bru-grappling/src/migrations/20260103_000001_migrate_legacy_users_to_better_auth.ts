import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migrate users created with Payload's built-in auth to Better Auth.
 *
 * Problem: Users created before the Better Auth migration have their passwords
 * stored in users.salt + users.hash (PBKDF2), but Better Auth looks for passwords
 * in the accounts table.
 *
 * Solution: Create credential accounts with the password stored as "salt:hash".
 * The custom password verification in @repo/auth-next/server handles both:
 * - New scrypt hashes (Better Auth default)
 * - Legacy "salt:hash" format (PBKDF2 from Payload CMS)
 *
 * This allows seamless login for legacy users WITHOUT password resets!
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Find all users that have salt/hash but no corresponding credential account
  // These are legacy users created with Payload's built-in auth
  // Store the password as "salt:hash" which our custom verifyPassword handles
  await db.execute(sql`
    INSERT INTO accounts (user_id, account_id, provider_id, password, updated_at, created_at)
    SELECT 
      u.id,
      u.id::text,  -- account_id equals user id for credential accounts
      'credential',
      u.salt || ':' || u.hash,  -- Store as "salt:hash" for legacy PBKDF2 verification
      NOW(),
      NOW()
    FROM users u
    WHERE u.salt IS NOT NULL 
      AND u.hash IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounts a 
        WHERE a.user_id = u.id 
        AND a.provider_id = 'credential'
      );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Remove credential accounts that contain the legacy "salt:hash" format
  // (They have a colon in the password field)
  await db.execute(sql`
    DELETE FROM accounts 
    WHERE provider_id = 'credential' 
    AND password LIKE '%:%';
  `)
}

