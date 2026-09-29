import { beforeEach, vi } from "vitest";
import db from "./src/data/database.ts";
import { resetTestDatabase } from "./src/test/database.ts";

// Every test file gets its own fresh in-memory database instead of the real
// `library.db` connection that `src/data/database.ts` opens at import time.
// `vi.mock` is hoisted above the imports, so `db` above is already the mock.
vi.mock("./src/data/database.ts", async () => {
  const { createTestDatabase } = await import("./src/test/database.ts");
  return { default: createTestDatabase() };
});

// Rows are cleared before every test, wherever the test is declared, so no
// test can observe rows written by another.
beforeEach(() => {
  resetTestDatabase(db);
});

// AGENTS.md forbids tests from reaching the network. Fail loudly instead of
// silently depending on it; a test that needs `fetch` stubs it itself.
beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("Tests must not hit the network");
  });
});
