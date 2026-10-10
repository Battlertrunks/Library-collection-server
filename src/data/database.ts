import Database from "better-sqlite3";

const db: Database.Database = new Database("library.db");
db.pragma("journal_mode = WAL");

type ColumnInfo = { name: string };

const collectedColumns = db
  .prepare("PRAGMA table_info(books_collected)")
  .all() as ColumnInfo[];

// Databases created before reading progress was tracked lack the `progress`
// column; add it in place so existing libraries keep working. Fresh databases
// get the column from src/data/sql/books-collected.sql instead.
if (
  collectedColumns.length > 0 &&
  !collectedColumns.some((column) => column.name === "progress")
) {
  db.exec(
    "ALTER TABLE books_collected ADD COLUMN progress INTEGER NOT NULL DEFAULT 0",
  );
}

export default db;
