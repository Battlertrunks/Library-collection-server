import { vi } from "vitest";

// Every test file gets its own fresh in-memory database instead of the real
// `library.db` connection that `src/data/database.ts` opens at import time.
vi.mock("./src/data/database.ts", async () => {
  const { createTestDatabase } = await import("./src/test/database.ts");
  return { default: createTestDatabase() };
});
