import { postgresAdapter } from "@payloadcms/db-postgres";

export const setDbString = (dbString: string) => {
  return postgresAdapter({
    pool: {
      connectionString: dbString,
    },
  });
};
