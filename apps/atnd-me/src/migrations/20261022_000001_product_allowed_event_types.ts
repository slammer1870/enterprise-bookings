import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Move class-pass and membership eligibility onto the products.
 * Copies paymentMethods.allowedPlans / allowedClassPasses rows from
 * event_types_rels or class_options_rels onto plans_rels and
 * class_pass_types_rels as allowedEventTypes, then drops those old rows.
 * Adds the per-event-type override array tables. No-ops when a table is absent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      src text;
      event_table text;
      src_tables text[] := ARRAY[]::text[];
      remaining bigint;
    BEGIN
      IF to_regclass('public.event_types') IS NOT NULL THEN
        event_table := 'event_types';
      ELSIF to_regclass('public.class_options') IS NOT NULL THEN
        event_table := 'class_options';
      ELSE
        event_table := NULL;
      END IF;

      IF to_regclass('public.event_types_rels') IS NOT NULL THEN
        src_tables := array_append(src_tables, 'event_types_rels');
      END IF;
      IF to_regclass('public.class_options_rels') IS NOT NULL THEN
        src_tables := array_append(src_tables, 'class_options_rels');
      END IF;

      IF to_regclass('public.plans') IS NOT NULL THEN
        CREATE TABLE IF NOT EXISTS "plans_rels" (
          "id" serial PRIMARY KEY NOT NULL,
          "order" integer,
          "parent_id" integer NOT NULL,
          "path" varchar NOT NULL,
          "event_types_id" integer
        );
        ALTER TABLE "plans_rels" ADD COLUMN IF NOT EXISTS "event_types_id" integer;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_rels_parent_fk') THEN
          ALTER TABLE "plans_rels"
            ADD CONSTRAINT "plans_rels_parent_fk"
            FOREIGN KEY ("parent_id") REFERENCES "public"."plans"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;

        IF event_table IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'plans_rels_event_types_fk'
        ) THEN
          EXECUTE format(
            'ALTER TABLE plans_rels ADD CONSTRAINT plans_rels_event_types_fk FOREIGN KEY (event_types_id) REFERENCES public.%I(id) ON DELETE cascade ON UPDATE no action',
            event_table
          );
        END IF;

        CREATE INDEX IF NOT EXISTS "plans_rels_order_idx" ON "plans_rels" USING btree ("order");
        CREATE INDEX IF NOT EXISTS "plans_rels_parent_idx" ON "plans_rels" USING btree ("parent_id");
        CREATE INDEX IF NOT EXISTS "plans_rels_path_idx" ON "plans_rels" USING btree ("path");
        CREATE INDEX IF NOT EXISTS "plans_rels_event_types_id_idx" ON "plans_rels" USING btree ("event_types_id");

        FOREACH src IN ARRAY src_tables LOOP
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = src AND column_name = 'plans_id'
          ) THEN
            EXECUTE format($copy$
              INSERT INTO plans_rels ("order", parent_id, path, event_types_id)
              SELECT
                COALESCE((
                  SELECT MAX(d."order") FROM plans_rels d
                  WHERE d.parent_id = sub.plans_id AND d.path = 'allowedEventTypes'
                ), 0) + sub.rn,
                sub.plans_id,
                'allowedEventTypes',
                sub.parent_id
              FROM (
                SELECT
                  plans_id,
                  parent_id,
                  ROW_NUMBER() OVER (PARTITION BY plans_id ORDER BY parent_id, id) AS rn
                FROM %I
                WHERE path = 'paymentMethods.allowedPlans'
                  AND plans_id IS NOT NULL
                  AND parent_id IS NOT NULL
              ) sub
              WHERE EXISTS (SELECT 1 FROM plans p WHERE p.id = sub.plans_id)
                AND NOT EXISTS (
                  SELECT 1 FROM plans_rels d
                  WHERE d.parent_id = sub.plans_id
                    AND d.path = 'allowedEventTypes'
                    AND d.event_types_id = sub.parent_id
                )
            $copy$, src);
          END IF;
        END LOOP;

        FOREACH src IN ARRAY src_tables LOOP
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = src AND column_name = 'plans_id'
          ) THEN
            EXECUTE format(
              'DELETE FROM %I WHERE path = %L',
              src,
              'paymentMethods.allowedPlans'
            );
            EXECUTE format(
              'SELECT COUNT(*) FROM %I WHERE plans_id IS NOT NULL',
              src
            ) INTO remaining;
            IF remaining = 0 THEN
              EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS class_options_rels_plans_fk', src);
              EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS event_types_rels_plans_fk', src);
              EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', src, src || '_plans_fk');
              EXECUTE format('DROP INDEX IF EXISTS %I', src || '_plans_id_idx');
              EXECUTE format('DROP INDEX IF EXISTS class_options_rels_plans_id_idx');
              EXECUTE format('DROP INDEX IF EXISTS event_types_rels_plans_id_idx');
              EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS plans_id', src);
            END IF;
          END IF;
        END LOOP;

        CREATE TABLE IF NOT EXISTS "plans_sessions_information_event_type_overrides" (
          "_order" integer NOT NULL,
          "_parent_id" integer NOT NULL,
          "id" varchar PRIMARY KEY NOT NULL,
          "event_type_id" integer NOT NULL,
          "sessions" numeric NOT NULL
        );

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'plans_sessions_information_event_type_overrides_parent_id_fk'
        ) THEN
          ALTER TABLE "plans_sessions_information_event_type_overrides"
            ADD CONSTRAINT "plans_sessions_information_event_type_overrides_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "public"."plans"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;

        IF event_table IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'plans_sessions_information_event_type_overrides_event_type_id_event_types_id_fk'
        ) THEN
          EXECUTE format(
            'ALTER TABLE plans_sessions_information_event_type_overrides ADD CONSTRAINT plans_sessions_information_event_type_overrides_event_type_id_event_types_id_fk FOREIGN KEY (event_type_id) REFERENCES public.%I(id) ON DELETE set null ON UPDATE no action',
            event_table
          );
        END IF;

        CREATE INDEX IF NOT EXISTS "plans_sessions_information_event_type_overrides_order_idx"
          ON "plans_sessions_information_event_type_overrides" USING btree ("_order");
        CREATE INDEX IF NOT EXISTS "plans_sessions_information_event_type_overrides_parent_id_idx"
          ON "plans_sessions_information_event_type_overrides" USING btree ("_parent_id");
        CREATE INDEX IF NOT EXISTS "plans_sessions_information_event_type_overrides_event_type_idx"
          ON "plans_sessions_information_event_type_overrides" USING btree ("event_type_id");
      END IF;

      IF to_regclass('public.class_pass_types') IS NOT NULL THEN
        CREATE TABLE IF NOT EXISTS "class_pass_types_rels" (
          "id" serial PRIMARY KEY NOT NULL,
          "order" integer,
          "parent_id" integer NOT NULL,
          "path" varchar NOT NULL,
          "event_types_id" integer
        );
        ALTER TABLE "class_pass_types_rels" ADD COLUMN IF NOT EXISTS "event_types_id" integer;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_pass_types_rels_parent_fk') THEN
          ALTER TABLE "class_pass_types_rels"
            ADD CONSTRAINT "class_pass_types_rels_parent_fk"
            FOREIGN KEY ("parent_id") REFERENCES "public"."class_pass_types"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;

        IF event_table IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'class_pass_types_rels_event_types_fk'
        ) THEN
          EXECUTE format(
            'ALTER TABLE class_pass_types_rels ADD CONSTRAINT class_pass_types_rels_event_types_fk FOREIGN KEY (event_types_id) REFERENCES public.%I(id) ON DELETE cascade ON UPDATE no action',
            event_table
          );
        END IF;

        CREATE INDEX IF NOT EXISTS "class_pass_types_rels_order_idx" ON "class_pass_types_rels" USING btree ("order");
        CREATE INDEX IF NOT EXISTS "class_pass_types_rels_parent_idx" ON "class_pass_types_rels" USING btree ("parent_id");
        CREATE INDEX IF NOT EXISTS "class_pass_types_rels_path_idx" ON "class_pass_types_rels" USING btree ("path");
        CREATE INDEX IF NOT EXISTS "class_pass_types_rels_event_types_id_idx" ON "class_pass_types_rels" USING btree ("event_types_id");

        FOREACH src IN ARRAY src_tables LOOP
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = src AND column_name = 'class_pass_types_id'
          ) THEN
            EXECUTE format($copy$
              INSERT INTO class_pass_types_rels ("order", parent_id, path, event_types_id)
              SELECT
                COALESCE((
                  SELECT MAX(d."order") FROM class_pass_types_rels d
                  WHERE d.parent_id = sub.class_pass_types_id AND d.path = 'allowedEventTypes'
                ), 0) + sub.rn,
                sub.class_pass_types_id,
                'allowedEventTypes',
                sub.parent_id
              FROM (
                SELECT
                  class_pass_types_id,
                  parent_id,
                  ROW_NUMBER() OVER (PARTITION BY class_pass_types_id ORDER BY parent_id, id) AS rn
                FROM %I
                WHERE path = 'paymentMethods.allowedClassPasses'
                  AND class_pass_types_id IS NOT NULL
                  AND parent_id IS NOT NULL
              ) sub
              WHERE EXISTS (SELECT 1 FROM class_pass_types t WHERE t.id = sub.class_pass_types_id)
                AND NOT EXISTS (
                  SELECT 1 FROM class_pass_types_rels d
                  WHERE d.parent_id = sub.class_pass_types_id
                    AND d.path = 'allowedEventTypes'
                    AND d.event_types_id = sub.parent_id
                )
            $copy$, src);
          END IF;
        END LOOP;

        FOREACH src IN ARRAY src_tables LOOP
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = src AND column_name = 'class_pass_types_id'
          ) THEN
            EXECUTE format(
              'DELETE FROM %I WHERE path = %L',
              src,
              'paymentMethods.allowedClassPasses'
            );
            EXECUTE format(
              'SELECT COUNT(*) FROM %I WHERE class_pass_types_id IS NOT NULL',
              src
            ) INTO remaining;
            IF remaining = 0 THEN
              EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS class_options_rels_class_pass_types_fk', src);
              EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS event_types_rels_class_pass_types_fk', src);
              EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', src, src || '_class_pass_types_fk');
              EXECUTE format('DROP INDEX IF EXISTS %I', src || '_class_pass_types_id_idx');
              EXECUTE format('DROP INDEX IF EXISTS class_options_rels_class_pass_types_id_idx');
              EXECUTE format('DROP INDEX IF EXISTS event_types_rels_class_pass_types_id_idx');
              EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS class_pass_types_id', src);
            END IF;
          END IF;
        END LOOP;

        CREATE TABLE IF NOT EXISTS "class_pass_types_event_type_overrides" (
          "_order" integer NOT NULL,
          "_parent_id" integer NOT NULL,
          "id" varchar PRIMARY KEY NOT NULL,
          "event_type_id" integer NOT NULL,
          "quantity" numeric NOT NULL
        );

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'class_pass_types_event_type_overrides_parent_id_fk'
        ) THEN
          ALTER TABLE "class_pass_types_event_type_overrides"
            ADD CONSTRAINT "class_pass_types_event_type_overrides_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "public"."class_pass_types"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;

        IF event_table IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'class_pass_types_event_type_overrides_event_type_id_event_types_id_fk'
        ) THEN
          EXECUTE format(
            'ALTER TABLE class_pass_types_event_type_overrides ADD CONSTRAINT class_pass_types_event_type_overrides_event_type_id_event_types_id_fk FOREIGN KEY (event_type_id) REFERENCES public.%I(id) ON DELETE set null ON UPDATE no action',
            event_table
          );
        END IF;

        CREATE INDEX IF NOT EXISTS "class_pass_types_event_type_overrides_order_idx"
          ON "class_pass_types_event_type_overrides" USING btree ("_order");
        CREATE INDEX IF NOT EXISTS "class_pass_types_event_type_overrides_parent_id_idx"
          ON "class_pass_types_event_type_overrides" USING btree ("_parent_id");
        CREATE INDEX IF NOT EXISTS "class_pass_types_event_type_overrides_event_type_idx"
          ON "class_pass_types_event_type_overrides" USING btree ("event_type_id");
      END IF;

      IF to_regclass('public.class_passes') IS NOT NULL THEN
        CREATE TABLE IF NOT EXISTS "class_passes_event_type_overrides" (
          "_order" integer NOT NULL,
          "_parent_id" integer NOT NULL,
          "id" varchar PRIMARY KEY NOT NULL,
          "event_type_id" integer NOT NULL,
          "quantity" numeric NOT NULL
        );

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'class_passes_event_type_overrides_parent_id_fk'
        ) THEN
          ALTER TABLE "class_passes_event_type_overrides"
            ADD CONSTRAINT "class_passes_event_type_overrides_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "public"."class_passes"("id")
            ON DELETE cascade ON UPDATE no action;
        END IF;

        IF event_table IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'class_passes_event_type_overrides_event_type_id_event_types_id_fk'
        ) THEN
          EXECUTE format(
            'ALTER TABLE class_passes_event_type_overrides ADD CONSTRAINT class_passes_event_type_overrides_event_type_id_event_types_id_fk FOREIGN KEY (event_type_id) REFERENCES public.%I(id) ON DELETE set null ON UPDATE no action',
            event_table
          );
        END IF;

        CREATE INDEX IF NOT EXISTS "class_passes_event_type_overrides_order_idx"
          ON "class_passes_event_type_overrides" USING btree ("_order");
        CREATE INDEX IF NOT EXISTS "class_passes_event_type_overrides_parent_id_idx"
          ON "class_passes_event_type_overrides" USING btree ("_parent_id");
        CREATE INDEX IF NOT EXISTS "class_passes_event_type_overrides_event_type_idx"
          ON "class_passes_event_type_overrides" USING btree ("event_type_id");
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      src text;
      event_table text;
    BEGIN
      IF to_regclass('public.event_types_rels') IS NOT NULL THEN
        src := 'event_types_rels';
      ELSIF to_regclass('public.class_options_rels') IS NOT NULL THEN
        src := 'class_options_rels';
      ELSE
        src := NULL;
      END IF;

      IF to_regclass('public.event_types') IS NOT NULL THEN
        event_table := 'event_types';
      ELSIF to_regclass('public.class_options') IS NOT NULL THEN
        event_table := 'class_options';
      ELSE
        event_table := NULL;
      END IF;

      IF src IS NOT NULL AND to_regclass('public.plans') IS NOT NULL AND to_regclass('public.plans_rels') IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS plans_id integer', src);
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = src || '_plans_fk'
        ) AND to_regclass('public.plans') IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (plans_id) REFERENCES public.plans(id) ON DELETE cascade ON UPDATE no action',
            src,
            src || '_plans_fk'
          );
        END IF;
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I USING btree (plans_id)', src || '_plans_id_idx', src);
        EXECUTE format($copy$
          INSERT INTO %I ("order", parent_id, path, plans_id)
          SELECT
            ROW_NUMBER() OVER (PARTITION BY event_types_id ORDER BY parent_id, id),
            event_types_id,
            'paymentMethods.allowedPlans',
            parent_id
          FROM plans_rels
          WHERE path = 'allowedEventTypes'
            AND event_types_id IS NOT NULL
            AND parent_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM %I existing
              WHERE existing.parent_id = plans_rels.event_types_id
                AND existing.path = 'paymentMethods.allowedPlans'
                AND existing.plans_id = plans_rels.parent_id
            )
        $copy$, src, src);
        DELETE FROM plans_rels WHERE path = 'allowedEventTypes';
      END IF;

      IF src IS NOT NULL AND to_regclass('public.class_pass_types') IS NOT NULL AND to_regclass('public.class_pass_types_rels') IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS class_pass_types_id integer', src);
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = src || '_class_pass_types_fk'
        ) THEN
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (class_pass_types_id) REFERENCES public.class_pass_types(id) ON DELETE cascade ON UPDATE no action',
            src,
            src || '_class_pass_types_fk'
          );
        END IF;
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I USING btree (class_pass_types_id)',
          src || '_class_pass_types_id_idx',
          src
        );
        EXECUTE format($copy$
          INSERT INTO %I ("order", parent_id, path, class_pass_types_id)
          SELECT
            ROW_NUMBER() OVER (PARTITION BY event_types_id ORDER BY parent_id, id),
            event_types_id,
            'paymentMethods.allowedClassPasses',
            parent_id
          FROM class_pass_types_rels
          WHERE path = 'allowedEventTypes'
            AND event_types_id IS NOT NULL
            AND parent_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM %I existing
              WHERE existing.parent_id = class_pass_types_rels.event_types_id
                AND existing.path = 'paymentMethods.allowedClassPasses'
                AND existing.class_pass_types_id = class_pass_types_rels.parent_id
            )
        $copy$, src, src);
        DELETE FROM class_pass_types_rels WHERE path = 'allowedEventTypes';
      END IF;

      DROP TABLE IF EXISTS "class_passes_event_type_overrides";
      DROP TABLE IF EXISTS "class_pass_types_event_type_overrides";
      DROP TABLE IF EXISTS "plans_sessions_information_event_type_overrides";

      IF to_regclass('public.plans_rels') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM plans_rels) THEN
          DROP TABLE "plans_rels";
        END IF;
      END IF;
      IF to_regclass('public.class_pass_types_rels') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM class_pass_types_rels) THEN
          DROP TABLE "class_pass_types_rels";
        END IF;
      END IF;
    END $$;
  `)
}
