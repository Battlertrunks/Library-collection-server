import Database from "better-sqlite3";

const db: Database.Database = new Database("library.db");
db.pragma("journal_mode = WAL");

export default db;
