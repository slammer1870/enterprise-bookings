import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero" ALTER COLUMN "video_id" SET NOT NULL;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-18T21:04:24.377Z';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero" ALTER COLUMN "video_id" DROP NOT NULL;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-16T18:54:06.452Z';`)
}
