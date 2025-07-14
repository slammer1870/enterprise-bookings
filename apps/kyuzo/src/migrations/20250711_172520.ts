import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db: _db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
    // Migration code
}

export async function down({ db: _db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
    // Migration code
}
