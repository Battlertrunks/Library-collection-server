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
 * Removes all rows between tests, keeping the schema in place. Table names are
 * read back from the schema instead of being hardcoded, so adding a
 * `src/data/sql` file cannot silently leave rows behind. Foreign keys stay
 * disabled here, matching production (which never enables them).
 */
export function resetTestDatabase(db: Database.Database): void {
  // `resetTestDatabase` deletes from every table in the schema, so refuse to
  // run against anything that is not the throwaway in-memory database. This
  // keeps `library.db` safe even if the `vitest.setup.ts` module mock ever
  // fails to apply.
  if (!db.memory) {
    throw new Error(
      `Refusing to reset the non-in-memory database "${db.name}"`,
    );
  }

  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    )
    .all() as Array<{ name: string }>;

  for (const { name } of tables) {
    db.prepare(`DELETE FROM "${name}"`).run();
  }
}
