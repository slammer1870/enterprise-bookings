import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_testimonials_testimonials" ALTER COLUMN "testimonial" SET DATA TYPE jsonb USING 
      CASE 
        WHEN "testimonial" IS NULL THEN NULL
        WHEN "testimonial" = '' THEN '[]'::jsonb
        WHEN "testimonial"::text ~ '^[\[\{]' THEN "testimonial"::jsonb
        ELSE json_build_array(json_build_object('type', 'paragraph', 'children', json_build_array(json_build_object('text', "testimonial"))))::jsonb
      END;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_testimonials_testimonials" ALTER COLUMN "testimonial" SET DATA TYPE varchar;
  `)
}
