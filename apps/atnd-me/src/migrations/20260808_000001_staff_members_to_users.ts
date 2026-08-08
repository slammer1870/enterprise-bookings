import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Consolidate staff-members into users:
 * 1. Replace users.image (varchar) with users.image_id (media upload)
 * 2. Copy profile images from staff_members → users.image_id
 * 3. Remap timeslots / scheduler staff_member_id from staff_members.id → users.id
 * 4. Move users_rels locations onto users_tenants locations (best-effort)
 * 5. Drop staff_members
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Better Auth stored `image` as a varchar URL. Convert to a media upload column.
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'image'
          AND data_type IN ('character varying', 'text', 'varchar')
      ) THEN
        ALTER TABLE "users" DROP COLUMN "image";
      END IF;
    END $$;
  `)

  // Drop leftover profile_image_id from earlier preview migration attempts.
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profile_image_id'
      ) THEN
        ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_profile_image_id_media_id_fk";
        DROP INDEX IF EXISTS "users_profile_image_idx";
        ALTER TABLE "users" DROP COLUMN "profile_image_id";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'image_id'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "image_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "users"
          ADD CONSTRAINT "users_image_id_media_id_fk"
          FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "users_image_idx" ON "users" USING btree ("image_id");
  `)

  // Copy images from staff_members when present
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff_members'
      ) THEN
        UPDATE "users" u
        SET image_id = sm.profile_image_id
        FROM "staff_members" sm
        WHERE sm.user_id = u.id
          AND sm.profile_image_id IS NOT NULL
          AND u.image_id IS NULL;
      END IF;
    END $$;
  `)

  // Remap timeslots.staff_member_id → user ids
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff_members'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'staff_member_id'
      ) THEN
        ALTER TABLE "timeslots" DROP CONSTRAINT IF EXISTS "timeslots_staff_member_id_staff_members_id_fk";
        ALTER TABLE "timeslots" DROP CONSTRAINT IF EXISTS "timeslots_staffMember_id_staffMembers_id_fk";

        UPDATE "timeslots" t
        SET staff_member_id = sm.user_id
        FROM "staff_members" sm
        WHERE t.staff_member_id = sm.id;

        UPDATE "timeslots" t
        SET staff_member_id = NULL
        WHERE t.staff_member_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = t.staff_member_id);

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'timeslots_staff_member_id_users_id_fk'
        ) THEN
          ALTER TABLE "timeslots"
            ADD CONSTRAINT "timeslots_staff_member_id_users_id_fk"
            FOREIGN KEY ("staff_member_id") REFERENCES "public"."users"("id")
            ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)

  // Remap scheduler week day time slot staff_member_id
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff_members'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'scheduler_week_days_time_slot'
          AND column_name = 'staff_member_id'
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot"
          DROP CONSTRAINT IF EXISTS "scheduler_week_days_time_slot_staff_member_id_staff_members_id_fk";

        UPDATE "scheduler_week_days_time_slot" s
        SET staff_member_id = sm.user_id
        FROM "staff_members" sm
        WHERE s.staff_member_id = sm.id;

        UPDATE "scheduler_week_days_time_slot" s
        SET staff_member_id = NULL
        WHERE s.staff_member_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = s.staff_member_id);

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'scheduler_week_days_time_slot_staff_member_id_users_id_fk'
        ) THEN
          ALTER TABLE "scheduler_week_days_time_slot"
            ADD CONSTRAINT "scheduler_week_days_time_slot_staff_member_id_users_id_fk"
            FOREIGN KEY ("staff_member_id") REFERENCES "public"."users"("id")
            ON DELETE set null ON UPDATE no action;
        END IF;
      END IF;
    END $$;
  `)

  // Ensure users_tenants_locs join table exists for tenants[].locations (Payload array hasMany)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users_tenants_locs'
      ) THEN
        CREATE TABLE "users_tenants_locs" (
          "order" integer NOT NULL,
          "parent_id" varchar NOT NULL,
          "value" integer,
          "path" varchar NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "users_tenants_locs_order_idx" ON "users_tenants_locs" USING btree ("order");
        CREATE INDEX IF NOT EXISTS "users_tenants_locs_parent_idx" ON "users_tenants_locs" USING btree ("parent_id");
        CREATE INDEX IF NOT EXISTS "users_tenants_locs_path_idx" ON "users_tenants_locs" USING btree ("path");
      END IF;
    END $$;
  `)

  // Best-effort: copy top-level users_rels locations onto matching users_tenants row locs
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users_rels'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users_rels' AND column_name = 'locations_id'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users_tenants'
      ) THEN
        INSERT INTO "users_tenants_locs" ("order", "parent_id", "value", "path")
        SELECT
          COALESCE(ur."order", 0),
          ut.id::varchar,
          ur.locations_id,
          'locations'
        FROM "users_rels" ur
        INNER JOIN "locations" loc ON loc.id = ur.locations_id
        INNER JOIN "users_tenants" ut
          ON ut._parent_id = ur.parent_id
          AND ut.tenant_id = loc.tenant_id
        WHERE ur.locations_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "users_tenants_locs" existing
            WHERE existing.parent_id = ut.id::varchar
              AND existing.value = ur.locations_id
              AND existing.path = 'locations'
          );
      END IF;
    END $$;
  `)

  // Clean locked docs rels for staff-members
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payload_locked_documents_rels'
          AND column_name = 'staff_members_id'
      ) THEN
        DELETE FROM "payload_locked_documents_rels" WHERE "staff_members_id" IS NOT NULL;
        ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_staff_members_fk";
        DROP INDEX IF EXISTS "payload_locked_documents_rels_staff_members_id_idx";
        ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "staff_members_id";
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DROP TABLE IF EXISTS "staff_members" CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Irreversible data remap; recreate empty staff_members shell only.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "staff_members" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer,
      "name" varchar,
      "description" varchar,
      "profile_image_id" integer,
      "active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_image_id_media_id_fk";
    DROP INDEX IF EXISTS "users_image_idx";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "image_id";
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" varchar;
  `)
}
