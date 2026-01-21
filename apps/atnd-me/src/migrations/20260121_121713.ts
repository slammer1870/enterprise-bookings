import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_parent_fk";
  
  ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_pages_fk";
  
  ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_posts_fk";
  
  DROP INDEX "footer_logo_idx";
  DROP INDEX "footer_rels_order_idx";
  DROP INDEX "footer_rels_parent_idx";
  DROP INDEX "footer_rels_path_idx";
  DROP INDEX "footer_rels_pages_id_idx";
  DROP INDEX "footer_rels_posts_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-21T12:17:12.932Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" DROP DEFAULT;
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" DROP DEFAULT;
  ALTER TABLE "scheduler" ALTER COLUMN "updated_at" SET DEFAULT now();
  ALTER TABLE "scheduler" ALTER COLUMN "updated_at" SET NOT NULL;
  ALTER TABLE "scheduler" ALTER COLUMN "created_at" SET DEFAULT now();
  ALTER TABLE "scheduler" ALTER COLUMN "created_at" SET NOT NULL;
  ALTER TABLE "users" ADD COLUMN "registration_tenant_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "footer_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "scheduler_id" integer;
  ALTER TABLE "scheduler" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "users" ADD CONSTRAINT "users_registration_tenant_id_tenants_id_fk" FOREIGN KEY ("registration_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_footer_fk" FOREIGN KEY ("footer_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scheduler_fk" FOREIGN KEY ("scheduler_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_parent_1_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_pages_1_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_posts_1_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_registration_tenant_idx" ON "users" USING btree ("registration_tenant_id");
  CREATE INDEX "payload_locked_documents_rels_footer_id_idx" ON "payload_locked_documents_rels" USING btree ("footer_id");
  CREATE INDEX "payload_locked_documents_rels_scheduler_id_idx" ON "payload_locked_documents_rels" USING btree ("scheduler_id");
  CREATE INDEX "footer_logo_1_idx" ON "footer" USING btree ("logo_id");
  CREATE INDEX "footer_rels_order_1_idx" ON "footer_rels" USING btree ("order");
  CREATE INDEX "footer_rels_parent_1_idx" ON "footer_rels" USING btree ("parent_id");
  CREATE INDEX "footer_rels_path_1_idx" ON "footer_rels" USING btree ("path");
  CREATE INDEX "footer_rels_pages_id_1_idx" ON "footer_rels" USING btree ("pages_id");
  CREATE INDEX "footer_rels_posts_id_1_idx" ON "footer_rels" USING btree ("posts_id");
  CREATE INDEX "scheduler_tenant_idx" ON "scheduler" USING btree ("tenant_id");
  CREATE INDEX "scheduler_updated_at_idx" ON "scheduler" USING btree ("updated_at");
  CREATE INDEX "scheduler_created_at_idx" ON "scheduler" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_parent_1_fk";
  
  ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_pages_1_fk";
  
  ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_posts_1_fk";
  
  ALTER TABLE "scheduler" DROP CONSTRAINT "scheduler_tenant_id_tenants_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT "users_registration_tenant_id_tenants_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_footer_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_scheduler_fk";
  
  DROP INDEX "footer_logo_1_idx";
  DROP INDEX "footer_rels_order_1_idx";
  DROP INDEX "footer_rels_parent_1_idx";
  DROP INDEX "footer_rels_path_1_idx";
  DROP INDEX "footer_rels_pages_id_1_idx";
  DROP INDEX "footer_rels_posts_id_1_idx";
  DROP INDEX "scheduler_tenant_idx";
  DROP INDEX "scheduler_updated_at_idx";
  DROP INDEX "scheduler_created_at_idx";
  DROP INDEX "users_registration_tenant_idx";
  DROP INDEX "payload_locked_documents_rels_footer_id_idx";
  DROP INDEX "payload_locked_documents_rels_scheduler_id_idx";
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2026-01-21T11:14:36.255Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2026-01-21T11:14:36.255Z';
  ALTER TABLE "scheduler" ALTER COLUMN "updated_at" DROP DEFAULT;
  ALTER TABLE "scheduler" ALTER COLUMN "updated_at" DROP NOT NULL;
  ALTER TABLE "scheduler" ALTER COLUMN "created_at" DROP DEFAULT;
  ALTER TABLE "scheduler" ALTER COLUMN "created_at" DROP NOT NULL;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2026-01-21T11:14:36.151Z';
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "footer_logo_idx" ON "footer" USING btree ("logo_id");
  CREATE INDEX "footer_rels_order_idx" ON "footer_rels" USING btree ("order");
  CREATE INDEX "footer_rels_parent_idx" ON "footer_rels" USING btree ("parent_id");
  CREATE INDEX "footer_rels_path_idx" ON "footer_rels" USING btree ("path");
  CREATE INDEX "footer_rels_pages_id_idx" ON "footer_rels" USING btree ("pages_id");
  CREATE INDEX "footer_rels_posts_id_idx" ON "footer_rels" USING btree ("posts_id");
  ALTER TABLE "scheduler" DROP COLUMN "tenant_id";
  ALTER TABLE "users" DROP COLUMN "registration_tenant_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "footer_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "scheduler_id";`)
}
