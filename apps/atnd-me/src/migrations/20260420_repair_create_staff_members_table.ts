import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Repair: some databases recorded later migrations while `staff_members` was never
 * created (or was dropped). Drizzle/Payload expect `public.staff_members` with the
 * shape from `20260120_171611` + `20260121_111436` (tenant_id), renamed table name only.
 *
 * Idempotent: no-op if `staff_members` or legacy `"staff-members"` already exists.
 * After creating the table, aligns `timeslots` / `scheduler_week_days_time_slot`
 * FKs (same intent as `20260417_*`). Orphan `staff_member_id` values that do not
 * resolve to a row in `staff_members` are set to NULL so FK creation can succeed.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = 'staff_members'
      ) OR EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = 'staff-members'
      ) THEN
        RETURN;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'users'
      )
      OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'tenants'
      )
      OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'media'
      ) THEN
        RAISE EXCEPTION 'repair_create_staff_members_table: required tables users, tenants, media must exist';
      END IF;

      CREATE TABLE "staff_members" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenant_id" integer,
        "user_id" integer NOT NULL,
        "name" varchar,
        "description" varchar,
        "profile_image_id" integer,
        "active" boolean DEFAULT true,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );

      ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
        ON DELETE set null ON UPDATE no action;

      ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;

      ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_profile_image_id_media_id_fk"
        FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;

      CREATE INDEX "staff_members_tenant_idx" ON "staff_members" USING btree ("tenant_id");
      CREATE UNIQUE INDEX "staff_members_user_idx" ON "staff_members" USING btree ("user_id");
      CREATE INDEX "staff_members_profile_image_idx" ON "staff_members" USING btree ("profile_image_id");
      CREATE INDEX "staff_members_updated_at_idx" ON "staff_members" USING btree ("updated_at");
      CREATE INDEX "staff_members_created_at_idx" ON "staff_members" USING btree ("created_at");
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'timeslots'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff_members'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'staff_member_id'
      ) THEN
        UPDATE "timeslots" t
        SET staff_member_id = NULL
        WHERE t.staff_member_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "staff_members" sm WHERE sm.id = t.staff_member_id);

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_schema = 'public'
            AND table_name = 'timeslots'
            AND constraint_name = 'timeslots_staff_member_id_staff_members_id_fk'
        ) THEN
          ALTER TABLE "timeslots" ADD CONSTRAINT "timeslots_staff_member_id_staff_members_id_fk"
            FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id")
            ON DELETE set null ON UPDATE no action;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_staff_member_idx'
        ) THEN
          CREATE INDEX IF NOT EXISTS "timeslots_staff_member_idx" ON "timeslots" USING btree ("staff_member_id");
        END IF;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff_members'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot'
          AND column_name = 'staff_member_id'
      ) THEN
        UPDATE "scheduler_week_days_time_slot" s
        SET staff_member_id = NULL
        WHERE s.staff_member_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "staff_members" sm WHERE sm.id = s.staff_member_id);

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_schema = 'public'
            AND table_name = 'scheduler_week_days_time_slot'
            AND constraint_name = 'scheduler_week_days_time_slot_staff_member_id_staff_members_id_fk'
        ) THEN
          ALTER TABLE "scheduler_week_days_time_slot"
            ADD CONSTRAINT "scheduler_week_days_time_slot_staff_member_id_staff_members_id_fk"
            FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id")
            ON DELETE set null ON UPDATE no action;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'scheduler_week_days_time_slot'
            AND indexname = 'scheduler_week_days_time_slot_staff_member_idx'
        ) THEN
          CREATE INDEX IF NOT EXISTS "scheduler_week_days_time_slot_staff_member_idx"
            ON "scheduler_week_days_time_slot" USING btree ("staff_member_id");
        END IF;
      END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Forward-only repair migration.
}
