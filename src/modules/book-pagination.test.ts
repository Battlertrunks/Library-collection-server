import { describe, expect, it } from "vitest";
import {
  fetchBookListingsPage,
  fetchBooksCollectedPage,
  type BookSort,
  type Connection,
} from "./book-pagination.ts";
import { insertCollected, insertListing } from "../test/seed.ts";

const ALL_SORTS: BookSort[] = [
  "RECENT",
  "TITLE_ASC",
  "TITLE_DESC",
  "PUBLISHED",
  "COMPLETION",
];

type Row = { id: number };

/**
 * Walks every page of a fetcher, returning the visited row ids in order.
 * Fails if the walk does not terminate within the guard.
 */
function walk<T extends Row>(
  fetchPage: (after: string | null) => Connection<T>,
): number[] {
  const ids: number[] = [];
  let after: string | null = null;

  for (let guard = 0; guard < 50; guard += 1) {
    const page = fetchPage(after);
    ids.push(...page.edges.map((edge) => edge.node.id));
    if (!page.pageInfo.hasNextPage) {
      return ids;
    }
    after = page.pageInfo.endCursor;
  }

  throw new Error("Pagination did not terminate");
}

/** Asserts the walk visits every id exactly once, whatever the page boundary. */
function expectCompleteTraversal(visited: number[], expected: number[]): void {
  expect(visited).toHaveLength(expected.length);
  expect(new Set(visited).size).toBe(visited.length);
  expect([...visited].sort((a, b) => a - b)).toEqual(
    [...expected].sort((a, b) => a - b),
  );
}

describe("fetchBookListingsPage", () => {
  /** Seven listings sharing sort keys so page boundaries land on ties. */
  function seedTiedListings(): number[] {
    return [
      insertListing("Zulu", {
        createdAt: "2026-01-01 00:00:00",
        publishedDate: "2020-01-01",
      }),
      insertListing("Alpha", {
        createdAt: "2026-01-01 00:00:00",
        publishedDate: "2020-01-01",
      }),
      insertListing("Alpha", {
        createdAt: "2026-02-01 00:00:00",
        publishedDate: "2021-01-01",
      }),
      insertListing("Bravo", {
        createdAt: "2026-02-01 00:00:00",
        publishedDate: "2021-01-01",
      }),
      insertListing("Charlie", {
        createdAt: "2026-03-01 00:00:00",
        publishedDate: "2022-01-01",
      }),
      insertListing("Delta", {
        createdAt: "2026-03-01 00:00:00",
        publishedDate: "2023-01-01",
      }),
      insertListing("Echo", {
        createdAt: "2026-04-01 00:00:00",
        publishedDate: "2023-01-01",
      }),
    ];
  }

  it.each(ALL_SORTS)(
    "visits every listing exactly once for %s across page boundaries",
    (sort) => {
      const ids = seedTiedListings();

      const visited = walk((after) =>
        fetchBookListingsPage({ first: 2, after, sort, search: null }),
      );

      expectCompleteTraversal(visited, ids);
    },
  );

  it("keeps pages aligned with the requested search", () => {
    const dune = insertListing("Dune", { authors: "Frank Herbert" });
    const dune2 = insertListing("Dune Messiah", { authors: "Frank Herbert" });
    insertListing("The Hobbit", { authors: "J.R.R. Tolkien" });
    insertListing("Dropsite Massacre", { authors: "Graham McNeill" });

    const visited = walk((after) =>
      fetchBookListingsPage({
        first: 1,
        after,
        sort: "TITLE_ASC",
        search: "dune herbert",
      }),
    );

    expectCompleteTraversal(visited, [dune, dune2]);
  });
});

describe("fetchBooksCollectedPage", () => {
  /** Five collected books with tied completion flags and titles. */
  function seedTiedCollected(): number[] {
    const alpha1 = insertListing("Alpha");
    const alpha2 = insertListing("Alpha");
    const bravo = insertListing("Bravo");
    const charlie = insertListing("Charlie");
    const delta = insertListing("Delta");

    insertCollected({ bookListingId: alpha1 }, "2026-01-01", true);
    insertCollected({ bookListingId: alpha2 }, "2026-01-02", false);
    insertCollected({ bookListingId: bravo }, "2026-01-03", true);
    insertCollected({ bookListingId: charlie }, "2026-01-04", false);
    insertCollected({ bookListingId: delta }, "2026-01-05", true);

    return [alpha1, alpha2, bravo, charlie, delta];
  }

  it.each(ALL_SORTS)(
    "visits every collected book exactly once for %s across page boundaries",
    (sort) => {
      seedTiedCollected();

      const visited = walk((after) =>
        fetchBooksCollectedPage({ first: 2, after, sort, search: null }),
      );

      expect(visited).toHaveLength(5);
      expect(new Set(visited).size).toBe(5);
    },
  );

  it("excludes collected rows without a listing from its pages", () => {
    const listing = insertListing("Dune");
    insertCollected({ bookListingId: listing }, "2026-01-01");
    insertCollected({}, "2026-01-02");
    insertCollected({}, "2026-01-03");

    const visited = walk((after) =>
      fetchBooksCollectedPage({ first: 2, after, sort: "RECENT" }),
    );

    expect(visited).toHaveLength(1);
  });
});
