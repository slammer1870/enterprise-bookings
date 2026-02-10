import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drop obsolete payment_methods_allowed_class_passes column from class_options.
 * This column was added by 20260127_class_options_allowed_class_passes as a boolean but
 * was incorrect - allowedClassPasses is a relationship stored in class_options_rels
 * (class_pass_types_id). Dropping aligns DB with Payload schema and resolves schema push warnings.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "class_options" DROP COLUMN IF EXISTS "payment_methods_allowed_class_passes";
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "class_options"
      ADD COLUMN IF NOT EXISTS "payment_methods_allowed_class_passes" boolean DEFAULT false;
  `)
}
