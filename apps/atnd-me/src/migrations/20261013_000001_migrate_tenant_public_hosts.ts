import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Superseded by 20261016_000002_migrate_hostname_list.
 * Rewriting `domain` and `aliasHosts` here would drop stored aliases before that migration reads them.
 */
export async function up(_args: MigrateUpArgs): Promise<void> {}

/** One-way. Legacy serving hostnames are not restored. */
export async function down(_args: MigrateDownArgs): Promise<void> {}
