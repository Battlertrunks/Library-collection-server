import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sqlDir: string = join(
  dirname(fileURLToPath(import.meta.url)),
  "../data/sql",
);

/**
 * Builds a throwaway in-memory database containing the production schema.
 * The schema is created by executing the real `src/data/sql/*.sql` files, so
 * drift between those files and the queries under test fails tests.
 */
export function createTestDatabase(): Database.Database {
  const db: Database.Database = new Database(":memory:");

  for (const file of readdirSync(sqlDir).sort()) {
    db.exec(readFileSync(join(sqlDir, file), "utf8"));
  }

  return db;
}

/**
 * Removes all rows between tests, keeping the schema in place. Foreign keys
 * stay disabled here, matching production (which never enables them).
 */
export function resetTestDatabase(db: Database.Database): void {
  db.exec(`
    DELETE FROM books_collected;
    DELETE FROM book_listings;
    DELETE FROM collections;
    DELETE FROM reviews;
    DELETE FROM series_collected;
  `);
}
