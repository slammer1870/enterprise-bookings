import { PostgreSqlContainer } from "@testcontainers/postgresql";

export const createDbString = async () => {
  const db = await new PostgreSqlContainer().start();

  return db.getConnectionUri();
};
