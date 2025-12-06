import { PostgreSqlContainer } from "@testcontainers/postgresql";

export const createDbString = async () => {
  try {
    // Explicitly specify the image to avoid parsing issues
    const db = await new PostgreSqlContainer("postgres:16-alpine").start();
    return db.getConnectionUri();
  } catch (error) {
    // If testcontainers fails (e.g., Docker not available), provide helpful error
    if (error instanceof Error) {
      const errorMessage = error.message;
      console.error("Testcontainers error:", errorMessage);
      throw new Error(
        `Failed to start PostgreSQL container: ${errorMessage}. ` +
          `Make sure Docker is running and accessible. ` +
          `Alternatively, set DATABASE_URI environment variable to use an existing database.`,
      );
    }
    throw error;
  }
};
