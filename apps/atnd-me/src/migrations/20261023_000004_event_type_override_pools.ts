import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * One override row is a pool of event types.
 * Payload stores hasMany relationships on the parent collection's rels table.
 * A one-type row becomes path `{group}.eventTypeOverrides.{index}.eventTypes` with order 1.
 * Index is the row's position within its parent, ordered by _order.
 */
const POOLS = [
  {
    arrayTable: 'plans_sessions_information_event_type_overrides',
    rels: 'plans_rels',
    parentTable: 'plans',
    pathPrefix: 'sessionsInformation.eventTypeOverrides.',
  },
  {
    arrayTable: 'class_pass_types_event_type_overrides',
    rels: 'class_pass_types_rels',
    parentTable: 'class_pass_types',
    pathPrefix: 'eventTypeOverrides.',
  },
  {
    arrayTable: 'class_passes_event_type_overrides',
    rels: 'class_passes_rels',
    parentTable: 'class_passes',
    pathPrefix: 'eventTypeOverrides.',
  },
] as const

function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

/** Postgres stores identifiers at 63 bytes. These names are ASCII. */
function pgIdent(value: string): string {
  return value.length <= 63 ? value : value.slice(0, 63)
}

function pathExpression(pathPrefix: string, indexSql: string): string {
  return `${quoteLiteral(pathPrefix)} || (${indexSql})::text || '.eventTypes'`
}

function upStatement(pool: (typeof POOLS)[number]): string {
  const oldFk = pgIdent(`${pool.arrayTable}_event_type_id_event_types_id_fk`)
  const oldIdx = pgIdent(`${pool.arrayTable}_event_type_idx`)
  const pathSql = pathExpression(pool.pathPrefix, 'ranked.idx')
  return `
    DO $$
    DECLARE
      event_table text;
    BEGIN
      IF to_regclass('public.event_types') IS NOT NULL THEN
        event_table := 'event_types';
      ELSIF to_regclass('public.class_options') IS NOT NULL THEN
        event_table := 'class_options';
      ELSE
        event_table := NULL;
      END IF;

      IF to_regclass(${quoteLiteral(`public.${pool.arrayTable}`)}) IS NULL
        OR to_regclass(${quoteLiteral(`public.${pool.parentTable}`)}) IS NULL THEN
        RETURN;
      END IF;

      CREATE TABLE IF NOT EXISTS ${quoteIdent(pool.rels)} (
        "id" serial PRIMARY KEY NOT NULL,
        "order" integer,
        "parent_id" integer NOT NULL,
        "path" varchar NOT NULL,
        "event_types_id" integer
      );

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = ${quoteLiteral(`${pool.rels}_parent_fk`)}
      ) THEN
        ALTER TABLE ${quoteIdent(pool.rels)}
          ADD CONSTRAINT ${quoteIdent(`${pool.rels}_parent_fk`)}
          FOREIGN KEY ("parent_id") REFERENCES ${quoteIdent(pool.parentTable)}("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;

      IF event_table IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = ${quoteLiteral(`${pool.rels}_event_types_fk`)}
      ) THEN
        EXECUTE format(
          'ALTER TABLE ${pool.rels} ADD CONSTRAINT ${pool.rels}_event_types_fk FOREIGN KEY ("event_types_id") REFERENCES public.%I(id) ON DELETE cascade ON UPDATE no action',
          event_table
        );
      END IF;

      CREATE INDEX IF NOT EXISTS ${quoteIdent(`${pool.rels}_order_idx`)} ON ${quoteIdent(pool.rels)} USING btree ("order");
      CREATE INDEX IF NOT EXISTS ${quoteIdent(`${pool.rels}_parent_idx`)} ON ${quoteIdent(pool.rels)} USING btree ("parent_id");
      CREATE INDEX IF NOT EXISTS ${quoteIdent(`${pool.rels}_path_idx`)} ON ${quoteIdent(pool.rels)} USING btree ("path");
      CREATE INDEX IF NOT EXISTS ${quoteIdent(`${pool.rels}_event_types_id_idx`)} ON ${quoteIdent(pool.rels)} USING btree ("event_types_id");

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${quoteLiteral(pool.arrayTable)}
          AND column_name = 'event_type_id'
      ) THEN
        INSERT INTO ${quoteIdent(pool.rels)} ("order", parent_id, path, event_types_id)
        SELECT 1, ranked._parent_id, ${pathSql}, ranked.event_type_id
        FROM (
          SELECT
            _parent_id,
            event_type_id,
            (row_number() OVER (PARTITION BY _parent_id ORDER BY _order, id) - 1) AS idx
          FROM ${quoteIdent(pool.arrayTable)}
          WHERE event_type_id IS NOT NULL
        ) AS ranked
        WHERE NOT EXISTS (
          SELECT 1 FROM ${quoteIdent(pool.rels)} rel
          WHERE rel.parent_id = ranked._parent_id
            AND rel.path = ${pathSql}
            AND rel.event_types_id = ranked.event_type_id
        );

        ALTER TABLE ${quoteIdent(pool.arrayTable)} DROP CONSTRAINT IF EXISTS ${quoteIdent(oldFk)};
        DROP INDEX IF EXISTS ${quoteIdent(oldIdx)};
        ALTER TABLE ${quoteIdent(pool.arrayTable)} DROP COLUMN IF EXISTS "event_type_id";
      END IF;
    END $$;
  `
}

function downStatement(pool: (typeof POOLS)[number]): string {
  const oldFk = pgIdent(`${pool.arrayTable}_event_type_id_event_types_id_fk`)
  const oldIdx = pgIdent(`${pool.arrayTable}_event_type_idx`)
  const pathMatch = quoteLiteral(`^${pool.pathPrefix.replaceAll('.', '\\.')}[0-9]+\\.eventTypes$`)
  const rankedPath = pathExpression(pool.pathPrefix, 'ranked.idx')
  return `
    DO $$
    DECLARE
      event_table text;
      missing bigint;
    BEGIN
      IF to_regclass('public.event_types') IS NOT NULL THEN
        event_table := 'event_types';
      ELSIF to_regclass('public.class_options') IS NOT NULL THEN
        event_table := 'class_options';
      ELSE
        event_table := NULL;
      END IF;

      IF to_regclass(${quoteLiteral(`public.${pool.arrayTable}`)}) IS NULL THEN
        RETURN;
      END IF;

      ALTER TABLE ${quoteIdent(pool.arrayTable)}
        ADD COLUMN IF NOT EXISTS "event_type_id" integer;

      IF to_regclass(${quoteLiteral(`public.${pool.rels}`)}) IS NOT NULL THEN
        UPDATE ${quoteIdent(pool.arrayTable)} AS override_row
        SET event_type_id = picked.event_types_id
        FROM (
          SELECT DISTINCT ON (parent_id, path) parent_id, path, event_types_id
          FROM ${quoteIdent(pool.rels)}
          WHERE path ~ ${pathMatch}
          ORDER BY parent_id, path, "order" NULLS LAST, id
        ) AS picked
        JOIN (
          SELECT
            id,
            _parent_id,
            (row_number() OVER (PARTITION BY _parent_id ORDER BY _order, id) - 1) AS idx
          FROM ${quoteIdent(pool.arrayTable)}
        ) AS ranked
          ON ranked._parent_id = picked.parent_id
          AND picked.path = ${rankedPath}
        WHERE override_row.id = ranked.id
          AND override_row.event_type_id IS NULL;

        DELETE FROM ${quoteIdent(pool.rels)} WHERE path ~ ${pathMatch};

        ${
          pool.rels === 'class_passes_rels'
            ? `IF NOT EXISTS (SELECT 1 FROM ${quoteIdent(pool.rels)}) THEN
          DROP TABLE ${quoteIdent(pool.rels)};
        END IF;`
            : ''
        }
      END IF;

      SELECT COUNT(*) INTO missing FROM ${quoteIdent(pool.arrayTable)} WHERE event_type_id IS NULL;
      IF missing = 0 THEN
        ALTER TABLE ${quoteIdent(pool.arrayTable)} ALTER COLUMN "event_type_id" SET NOT NULL;
      END IF;

      IF event_table IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = ${quoteLiteral(oldFk)}
      ) THEN
        EXECUTE format(
          'ALTER TABLE ${pool.arrayTable} ADD CONSTRAINT ${oldFk} FOREIGN KEY (event_type_id) REFERENCES public.%I(id) ON DELETE set null ON UPDATE no action',
          event_table
        );
      END IF;

      CREATE INDEX IF NOT EXISTS ${quoteIdent(oldIdx)}
        ON ${quoteIdent(pool.arrayTable)} USING btree ("event_type_id");
    END $$;
  `
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const pool of POOLS) {
    await db.execute(sql.raw(upStatement(pool)))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const pool of POOLS) {
    await db.execute(sql.raw(downStatement(pool)))
  }
}
