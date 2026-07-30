import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Convert courses.about from plain varchar to Lexical richText jsonb.
 * Preserves existing plain-text values as a single paragraph.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'courses'
          AND column_name = 'about'
          AND data_type <> 'jsonb'
      ) THEN
        ALTER TABLE "courses" ADD COLUMN "about_richtext" jsonb;

        UPDATE "courses"
        SET "about_richtext" = CASE
          WHEN "about" IS NULL OR btrim("about") = '' THEN NULL
          ELSE jsonb_build_object(
            'root', jsonb_build_object(
              'type', 'root',
              'format', '',
              'indent', 0,
              'version', 1,
              'direction', 'ltr',
              'children', jsonb_build_array(
                jsonb_build_object(
                  'type', 'paragraph',
                  'format', '',
                  'indent', 0,
                  'version', 1,
                  'direction', 'ltr',
                  'textFormat', 0,
                  'children', jsonb_build_array(
                    jsonb_build_object(
                      'type', 'text',
                      'detail', 0,
                      'format', 0,
                      'mode', 'normal',
                      'style', '',
                      'text', "about",
                      'version', 1
                    )
                  )
                )
              )
            )
          )
        END;

        ALTER TABLE "courses" DROP COLUMN "about";
        ALTER TABLE "courses" RENAME COLUMN "about_richtext" TO "about";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'courses'
          AND column_name = 'about'
          AND data_type = 'jsonb'
      ) THEN
        ALTER TABLE "courses" ADD COLUMN "about_text" varchar;

        UPDATE "courses"
        SET "about_text" = NULLIF(
          btrim(
            coalesce(
              (
                SELECT string_agg(node->>'text', ' ')
                FROM jsonb_path_query("about", '$.root.children[*].children[*].text') AS node
              ),
              ''
            )
          ),
          ''
        );

        ALTER TABLE "courses" DROP COLUMN "about";
        ALTER TABLE "courses" RENAME COLUMN "about_text" TO "about";
      END IF;
    END $$;
  `)
}
