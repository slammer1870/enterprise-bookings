import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add tenants.applePayDomainAssociation for Apple Pay domain verification.
 * Served at /.well-known/apple-developer-merchantid-domain-association per tenant domain.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "apple_pay_domain_association" text;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "apple_pay_domain_association";
  `)
}

