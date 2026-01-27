import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_navbar_nav_items_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_navbar_nav_items_button_variant" AS ENUM('default', 'outline', 'secondary', 'ghost');
  CREATE TYPE "public"."enum_navbar_styling_padding" AS ENUM('small', 'medium', 'large');
  ALTER TYPE "public"."enum_admin_invitations_role" ADD VALUE 'tenant-admin';
  ALTER TYPE "public"."enum_users_roles" ADD VALUE 'tenant-admin';
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'tenant-admin';
  CREATE TABLE "tenants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"domain" varchar,
  	"description" varchar,
  	"logo_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "navbar_nav_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_navbar_nav_items_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar NOT NULL,
  	"render_as_button" boolean DEFAULT false,
  	"button_variant" "enum_navbar_nav_items_button_variant" DEFAULT 'default'
  );
  
  CREATE TABLE "navbar" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"logo_id" integer,
  	"logo_link" varchar DEFAULT '/',
  	"styling_background_color" varchar,
  	"styling_text_color" varchar,
  	"styling_sticky" boolean DEFAULT false,
  	"styling_padding" "enum_navbar_styling_padding" DEFAULT 'medium',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "navbar_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer
  );
  
  CREATE TABLE "users_tenants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL
  );
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-21T11:14:36.151Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-21T11:14:36.255Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-21T11:14:36.255Z';
  ALTER TABLE "pages" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "_pages_v" ADD COLUMN "version_tenant_id" integer;
  ALTER TABLE "instructors" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "lessons" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "class_options" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "bookings" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tenants_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "navbar_id" integer;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navbar_nav_items" ADD CONSTRAINT "navbar_nav_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navbar"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navbar" ADD CONSTRAINT "navbar_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navbar" ADD CONSTRAINT "navbar_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navbar_rels" ADD CONSTRAINT "navbar_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."navbar"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navbar_rels" ADD CONSTRAINT "navbar_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navbar_rels" ADD CONSTRAINT "navbar_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");
  CREATE INDEX "tenants_logo_idx" ON "tenants" USING btree ("logo_id");
  CREATE INDEX "tenants_updated_at_idx" ON "tenants" USING btree ("updated_at");
  CREATE INDEX "tenants_created_at_idx" ON "tenants" USING btree ("created_at");
  CREATE INDEX "navbar_nav_items_order_idx" ON "navbar_nav_items" USING btree ("_order");
  CREATE INDEX "navbar_nav_items_parent_id_idx" ON "navbar_nav_items" USING btree ("_parent_id");
  CREATE INDEX "navbar_tenant_idx" ON "navbar" USING btree ("tenant_id");
  CREATE INDEX "navbar_logo_idx" ON "navbar" USING btree ("logo_id");
  CREATE INDEX "navbar_updated_at_idx" ON "navbar" USING btree ("updated_at");
  CREATE INDEX "navbar_created_at_idx" ON "navbar" USING btree ("created_at");
  CREATE INDEX "navbar_rels_order_idx" ON "navbar_rels" USING btree ("order");
  CREATE INDEX "navbar_rels_parent_idx" ON "navbar_rels" USING btree ("parent_id");
  CREATE INDEX "navbar_rels_path_idx" ON "navbar_rels" USING btree ("path");
  CREATE INDEX "navbar_rels_pages_id_idx" ON "navbar_rels" USING btree ("pages_id");
  CREATE INDEX "navbar_rels_posts_id_idx" ON "navbar_rels" USING btree ("posts_id");
  CREATE INDEX "users_tenants_order_idx" ON "users_tenants" USING btree ("_order");
  CREATE INDEX "users_tenants_parent_id_idx" ON "users_tenants" USING btree ("_parent_id");
  CREATE INDEX "users_tenants_tenant_idx" ON "users_tenants" USING btree ("tenant_id");
  ALTER TABLE "pages" ADD CONSTRAINT "pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "instructors" ADD CONSTRAINT "instructors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "class_options" ADD CONSTRAINT "class_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_navbar_fk" FOREIGN KEY ("navbar_id") REFERENCES "public"."navbar"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_tenant_idx" ON "pages" USING btree ("tenant_id");
  CREATE INDEX "_pages_v_version_version_tenant_idx" ON "_pages_v" USING btree ("version_tenant_id");
  CREATE INDEX "instructors_tenant_idx" ON "instructors" USING btree ("tenant_id");
  CREATE INDEX "lessons_tenant_idx" ON "lessons" USING btree ("tenant_id");
  CREATE INDEX "class_options_tenant_idx" ON "class_options" USING btree ("tenant_id");
  CREATE INDEX "bookings_tenant_idx" ON "bookings" USING btree ("tenant_id");
  CREATE INDEX "payload_locked_documents_rels_tenants_id_idx" ON "payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX "payload_locked_documents_rels_navbar_id_idx" ON "payload_locked_documents_rels" USING btree ("navbar_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "navbar_nav_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "navbar" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "navbar_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_tenants" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tenants" CASCADE;
  DROP TABLE "navbar_nav_items" CASCADE;
  DROP TABLE "navbar" CASCADE;
  DROP TABLE "navbar_rels" CASCADE;
  DROP TABLE "users_tenants" CASCADE;
  ALTER TABLE "pages" DROP CONSTRAINT "pages_tenant_id_tenants_id_fk";
  
  ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_tenant_id_tenants_id_fk";
  
  ALTER TABLE "instructors" DROP CONSTRAINT "instructors_tenant_id_tenants_id_fk";
  
  ALTER TABLE "lessons" DROP CONSTRAINT "lessons_tenant_id_tenants_id_fk";
  
  ALTER TABLE "class_options" DROP CONSTRAINT "class_options_tenant_id_tenants_id_fk";
  
  ALTER TABLE "bookings" DROP CONSTRAINT "bookings_tenant_id_tenants_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tenants_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_navbar_fk";
  
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DEFAULT 'admin'::text;
  DROP TYPE "public"."enum_admin_invitations_role";
  CREATE TYPE "public"."enum_admin_invitations_role" AS ENUM('admin', 'user');
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DEFAULT 'admin'::"public"."enum_admin_invitations_role";
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DATA TYPE "public"."enum_admin_invitations_role" USING "role"::"public"."enum_admin_invitations_role";
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_roles";
  CREATE TYPE "public"."enum_users_roles" AS ENUM('user', 'admin');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'user');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  DROP INDEX "pages_tenant_idx";
  DROP INDEX "_pages_v_version_version_tenant_idx";
  DROP INDEX "instructors_tenant_idx";
  DROP INDEX "lessons_tenant_idx";
  DROP INDEX "class_options_tenant_idx";
  DROP INDEX "bookings_tenant_idx";
  DROP INDEX "payload_locked_documents_rels_tenants_id_idx";
  DROP INDEX "payload_locked_documents_rels_navbar_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-20T20:06:11.924Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-20T20:06:12.060Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-20T20:06:12.060Z';
  ALTER TABLE "pages" DROP COLUMN "tenant_id";
  ALTER TABLE "_pages_v" DROP COLUMN "version_tenant_id";
  ALTER TABLE "instructors" DROP COLUMN "tenant_id";
  ALTER TABLE "lessons" DROP COLUMN "tenant_id";
  ALTER TABLE "class_options" DROP COLUMN "tenant_id";
  ALTER TABLE "bookings" DROP COLUMN "tenant_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tenants_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "navbar_id";
  DROP TYPE "public"."enum_navbar_nav_items_link_type";
  DROP TYPE "public"."enum_navbar_nav_items_button_variant";
  DROP TYPE "public"."enum_navbar_styling_padding";`)
}
