import { ApolloServer } from "@apollo/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import db from "../data/database.ts";
import { typeDefs } from "../schemas/typeDefs.ts";
import { insertCollected, insertListing } from "../test/seed.ts";
import resolvers from "./resolvers.ts";

const server = new ApolloServer({ typeDefs, resolvers });

/**
 * Runs an operation and returns its single result untouched, so tests can
 * assert on GraphQL errors; use `runQuery` for the happy path.
 */
async function runOperation(query: string) {
  const result = await server.executeOperation({ query });

  if (result.body.kind !== "single") {
    throw new Error("Expected a single GraphQL response");
  }

  return result.body.singleResult;
}

/** Runs a query, failing loudly on GraphQL errors instead of returning them. */
async function runQuery(query: string): Promise<Record<string, unknown>> {
  const { errors, data } = await runOperation(query);

  if (errors?.length) {
    throw new Error(errors[0]?.message ?? "GraphQL query failed");
  }

  return data ?? {};
}

type Edge<T> = { node: T; cursor: string };
type Connection<T> = {
  edges: Array<Edge<T>>;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

/** Reads a connection field out of a query result. */
function connectionOf<T>(
  data: Record<string, unknown>,
  field: string,
): Connection<T> {
  return data[field] as Connection<T>;
}

/** Builds a book_listings query around the given args and node fields. */
function listingsQuery(args: string = "", fields: string = "title"): string {
  return `{
    book_listings${args} {
      edges { node { ${fields} } cursor }
      pageInfo { hasNextPage endCursor }
    }
  }`;
}

/** Builds a books_collected query around the given args and node fields. */
function collectedQuery(args: string = "", fields: string = "title"): string {
  return `{
    books_collected${args} {
      edges { node { ${fields} } cursor }
      pageInfo { hasNextPage endCursor }
    }
  }`;
}

/** Builds the add_book_collected mutation, defaulting to selecting its `id`. */
function addBookCollectedMutation(
  bookListingId: string,
  fields: string = "id",
): string {
  return `mutation {
    add_book_collected(book_listing_id: "${bookListingId}") { ${fields} }
  }`;
}

/** Builds the remove_book_collected mutation, defaulting to selecting its `id`. */
function removeBookCollectedMutation(
  bookListingId: string,
  fields: string = "id",
): string {
  return `mutation {
    remove_book_collected(book_listing_id: "${bookListingId}") { ${fields} }
  }`;
}

/** Builds the update_book_progress mutation, defaulting to selecting its `id`. */
function updateBookProgressMutation(
  bookListingId: string,
  progress: number,
  fields: string = "id",
): string {
  return `mutation {
    update_book_progress(book_listing_id: "${bookListingId}", progress: ${progress}) { ${fields} }
  }`;
}

/** Builds the book_of_the_day query around the given node fields. */
function bookOfTheDayQuery(fields: string = "id title"): string {
  return `{ book_of_the_day { ${fields} } }`;
}

describe("book_listings query", () => {
  it("returns listings that are neither owned nor collected", async () => {
    insertListing("The Hobbit");
    insertListing("The Silmarillion", { doesOwn: true });
    const collected = insertListing("Dune");
    insertCollected({ bookListingId: collected }, "2026-01-01");

    const data = await runQuery(listingsQuery());

    const titles = connectionOf<{ title: string }>(
      data,
      "book_listings",
    ).edges.map((edge) => edge.node.title);
    expect(titles).toEqual(["The Hobbit"]);
  });

  it("exposes the created_at timestamp of each listing", async () => {
    const listingId = insertListing("The Hobbit");

    const data = await runQuery(listingsQuery("", "id created_at"));

    expect(connectionOf(data, "book_listings").edges).toEqual([
      {
        node: { id: String(listingId), created_at: expect.any(String) },
        cursor: expect.any(String),
      },
    ]);
  });

  it("walks pages with cursors without overlap or gaps", async () => {
    for (let i = 1; i <= 5; i += 1) {
      insertListing(`Book ${i}`, { createdAt: `2026-01-0${i} 00:00:00` });
    }

    const first = await runQuery(listingsQuery("(first: 2)"));
    const page1 = connectionOf<{ title: string }>(first, "book_listings");
    expect(page1.edges.map((edge) => edge.node.title)).toEqual([
      "Book 5",
      "Book 4",
    ]);
    expect(page1.pageInfo.hasNextPage).toBe(true);

    const second = await runQuery(
      listingsQuery(`(first: 2, after: "${page1.pageInfo.endCursor}")`),
    );
    const page2 = connectionOf<{ title: string }>(second, "book_listings");
    expect(page2.edges.map((edge) => edge.node.title)).toEqual([
      "Book 3",
      "Book 2",
    ]);
    expect(page2.pageInfo.hasNextPage).toBe(true);

    const third = await runQuery(
      listingsQuery(`(first: 2, after: "${page2.pageInfo.endCursor}")`),
    );
    const page3 = connectionOf<{ title: string }>(third, "book_listings");
    expect(page3.edges.map((edge) => edge.node.title)).toEqual(["Book 1"]);
    expect(page3.pageInfo.hasNextPage).toBe(false);
    expect(page3.pageInfo.endCursor).not.toBeNull();
  });

  it("sorts titles case-insensitively A to Z and Z to A", async () => {
    insertListing("Zeta");
    insertListing("alpha");
    insertListing("Beta");

    const az = await runQuery(listingsQuery("(sort: TITLE_ASC)"));
    expect(
      connectionOf<{ title: string }>(az, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["alpha", "Beta", "Zeta"]);

    const za = await runQuery(listingsQuery("(sort: TITLE_DESC)"));
    expect(
      connectionOf<{ title: string }>(za, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["Zeta", "Beta", "alpha"]);
  });

  it("sorts newest created first, breaking ties alphabetically", async () => {
    insertListing("Zulu", { createdAt: "2026-02-01 00:00:00" });
    insertListing("Old", { createdAt: "2025-01-01 00:00:00" });
    insertListing("Alpha", { createdAt: "2026-02-01 00:00:00" });

    const data = await runQuery(listingsQuery("(sort: RECENT)"));

    expect(
      connectionOf<{ title: string }>(data, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["Alpha", "Zulu", "Old"]);
  });

  it("sorts newest published first, breaking ties alphabetically", async () => {
    insertListing("Old", { publishedDate: "2001-01-01" });
    insertListing("New", { publishedDate: "2024-01-01" });
    insertListing("Also New", { publishedDate: "2024-01-01" });

    const data = await runQuery(listingsQuery("(sort: PUBLISHED)"));

    expect(
      connectionOf<{ title: string }>(data, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["Also New", "New", "Old"]);
  });

  it("treats COMPLETION as alphabetical for listings", async () => {
    insertListing("Zeta");
    insertListing("Alpha");

    const data = await runQuery(listingsQuery("(sort: COMPLETION)"));

    expect(
      connectionOf<{ title: string }>(data, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["Alpha", "Zeta"]);
  });

  it("searches titles and authors case-insensitively", async () => {
    insertListing("Dune", { authors: "Frank Herbert" });
    insertListing("Dropsite Massacre", { authors: "Graham McNeill" });
    insertListing("The Hobbit", { authors: "J.R.R. Tolkien" });

    const byTitle = await runQuery(listingsQuery('(search: "MASSACRE")'));
    expect(
      connectionOf<{ title: string }>(byTitle, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["Dropsite Massacre"]);

    const byAuthor = await runQuery(listingsQuery('(search: "tolkien")'));
    expect(
      connectionOf<{ title: string }>(byAuthor, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["The Hobbit"]);
  });

  it("requires every search keyword to match across title and authors", async () => {
    insertListing("Dune", { authors: "Frank Herbert" });
    insertListing("The Hobbit", { authors: "J.R.R. Tolkien" });

    const match = await runQuery(listingsQuery('(search: "herbert dune")'));
    expect(
      connectionOf<{ title: string }>(match, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["Dune"]);

    const noMatch = await runQuery(listingsQuery('(search: "dune tolkien")'));
    expect(
      connectionOf<{ title: string }>(noMatch, "book_listings").edges,
    ).toEqual([]);
  });

  it("treats LIKE metacharacters literally in search", async () => {
    insertListing("100% Complete");
    insertListing("D_une");
    insertListing("Dune");

    const percent = await runQuery(listingsQuery('(search: "100%")'));
    expect(
      connectionOf<{ title: string }>(percent, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["100% Complete"]);

    const underscore = await runQuery(listingsQuery('(search: "d_une")'));
    expect(
      connectionOf<{ title: string }>(underscore, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["D_une"]);
  });

  it("rejects a malformed cursor", async () => {
    insertListing("Dune");

    const { data, errors } = await runOperation(
      listingsQuery('(after: "not-a-cursor")'),
    );

    expect(data).toBeNull();
    expect(errors?.[0]).toMatchObject({
      message: "Invalid pagination cursor",
      extensions: { code: "INVALID_CURSOR" },
    });
  });

  it("rejects a cursor issued for a different sort", async () => {
    insertListing("Dune");
    insertListing("Dropsite Massacre");

    const alphabetical = await runQuery(
      listingsQuery("(first: 1, sort: TITLE_ASC)"),
    );
    const cursor = connectionOf(alphabetical, "book_listings").pageInfo
      .endCursor;

    const { data, errors } = await runOperation(
      listingsQuery(`(after: "${cursor}", sort: RECENT)`),
    );

    expect(data).toBeNull();
    expect(errors?.[0]?.extensions?.code).toBe("INVALID_CURSOR");
  });

  it.each([0, -1, 101])("rejects the invalid page size %i", async (first) => {
    const { data, errors } = await runOperation(
      `{ book_listings(first: ${first}) { edges { cursor } } }`,
    );

    expect(data).toBeNull();
    expect(errors?.[0]).toMatchObject({
      message: `Invalid page size: ${first}`,
      extensions: { code: "INVALID_PAGE_SIZE" },
    });
  });
});

describe("books_collected query", () => {
  it("joins the listing fields of collected books", async () => {
    const listingId = insertListing("Dune", { publishedDate: "1965-08-01" });
    db.prepare(
      `UPDATE book_listings
          SET thumbnail_url = 'https://covers.example/dune.jpg'
        WHERE id = ?`,
    ).run(listingId);
    const collectedId = insertCollected(
      { bookListingId: listingId },
      "2026-01-01",
      false,
      40,
    );

    const data = await runQuery(
      collectedQuery(
        "",
        "id book_listing_id title authors thumbnail_url published_date created_at completed progress",
      ),
    );

    expect(connectionOf(data, "books_collected").edges).toEqual([
      {
        node: {
          id: String(collectedId),
          book_listing_id: String(listingId),
          title: "Dune",
          authors: "Dune Author",
          thumbnail_url: "https://covers.example/dune.jpg",
          published_date: "1965-08-01",
          created_at: expect.any(String),
          completed: false,
          progress: 40,
        },
        cursor: expect.any(String),
      },
    ]);
  });

  it("excludes series-owned entries", async () => {
    db.prepare("INSERT INTO series_collected (name) VALUES ('A Series')").run();
    const series = db.prepare("SELECT id FROM series_collected").get() as {
      id: number;
    };
    insertCollected({ bookSeriesId: series.id }, "2026-02-01");

    const data = await runQuery(collectedQuery());

    expect(connectionOf(data, "books_collected").edges).toEqual([]);
  });

  it("sorts by reading progress descending for COMPLETION, alphabetical within ties", async () => {
    const alpha = insertListing("Alpha");
    const bravo = insertListing("Bravo");
    const charlie = insertListing("Charlie");
    const delta = insertListing("Delta");
    insertCollected({ bookListingId: alpha }, "2026-01-01", false, 40);
    insertCollected({ bookListingId: bravo }, "2026-01-02", true);
    insertCollected({ bookListingId: charlie }, "2026-01-03", false, 80);
    insertCollected({ bookListingId: delta }, "2026-01-04", false, 40);

    const first = await runQuery(
      collectedQuery("(first: 2, sort: COMPLETION)"),
    );
    const page1 = connectionOf<{ title: string }>(first, "books_collected");
    expect(page1.edges.map((edge) => edge.node.title)).toEqual([
      "Bravo",
      "Charlie",
    ]);
    expect(page1.pageInfo.hasNextPage).toBe(true);

    const second = await runQuery(
      collectedQuery(
        `(first: 2, after: "${page1.pageInfo.endCursor}", sort: COMPLETION)`,
      ),
    );
    const page2 = connectionOf<{ title: string }>(second, "books_collected");
    expect(page2.edges.map((edge) => edge.node.title)).toEqual([
      "Alpha",
      "Delta",
    ]);
    expect(page2.pageInfo.hasNextPage).toBe(false);
  });

  it("filters collected books by finished state", async () => {
    const alpha = insertListing("Alpha");
    const bravo = insertListing("Bravo");
    insertCollected({ bookListingId: alpha }, "2026-01-01", false, 25);
    insertCollected({ bookListingId: bravo }, "2026-01-02", true);

    const unfinished = await runQuery(
      collectedQuery("(completed: false)", "title progress"),
    );
    expect(
      connectionOf<{ title: string }>(unfinished, "books_collected").edges.map(
        (edge) => edge.node,
      ),
    ).toEqual([{ title: "Alpha", progress: 25 }]);

    const finished = await runQuery(
      collectedQuery("(completed: true)", "title progress"),
    );
    expect(
      connectionOf<{ title: string }>(finished, "books_collected").edges.map(
        (edge) => edge.node,
      ),
    ).toEqual([{ title: "Bravo", progress: 100 }]);
  });

  it("searches the joined listing title and authors", async () => {
    const dune = insertListing("Dune", { authors: "Frank Herbert" });
    const hobbit = insertListing("The Hobbit", { authors: "J.R.R. Tolkien" });
    insertCollected({ bookListingId: dune }, "2026-01-01");
    insertCollected({ bookListingId: hobbit }, "2026-01-02");

    const data = await runQuery(collectedQuery('(search: "hobbit tolkien")'));

    expect(
      connectionOf<{ title: string }>(data, "books_collected").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["The Hobbit"]);
  });

  it("walks pages with cursors without overlap", async () => {
    for (let i = 1; i <= 3; i += 1) {
      const listing = insertListing(`Collected ${i}`);
      insertCollected({ bookListingId: listing }, `2026-01-0${i}`, false);
    }

    const first = await runQuery(collectedQuery("(first: 2)"));
    const page1 = connectionOf<{ title: string }>(first, "books_collected");
    expect(page1.edges).toHaveLength(2);
    expect(page1.pageInfo.hasNextPage).toBe(true);

    const second = await runQuery(
      collectedQuery(`(first: 2, after: "${page1.pageInfo.endCursor}")`),
    );
    const page2 = connectionOf<{ title: string }>(second, "books_collected");
    expect(page2.edges).toHaveLength(1);
    expect(page2.pageInfo.hasNextPage).toBe(false);

    const firstTitles = page1.edges.map((edge) => edge.node.title);
    const secondTitles = page2.edges.map((edge) => edge.node.title);
    expect(new Set([...firstTitles, ...secondTitles]).size).toBe(3);
  });
});

describe("book_of_the_day query", () => {
  it("returns an unfinished owned book", async () => {
    const listingId = insertListing("Dune");
    insertCollected({ bookListingId: listingId }, "2026-01-01", false, 35);

    const data = await runQuery(
      bookOfTheDayQuery("id book_listing_id title progress completed"),
    );

    expect(data).toEqual({
      book_of_the_day: {
        id: expect.any(String),
        book_listing_id: String(listingId),
        title: "Dune",
        progress: 35,
        completed: false,
      },
    });
  });

  it("returns null when every owned book is finished", async () => {
    const listingId = insertListing("Dune");
    insertCollected({ bookListingId: listingId }, "2026-01-01", true);

    const data = await runQuery(bookOfTheDayQuery());

    expect(data).toEqual({ book_of_the_day: null });
  });

  it("ignores series-owned rows", async () => {
    insertCollected({}, "2026-01-01");

    const data = await runQuery(bookOfTheDayQuery());

    expect(data).toEqual({ book_of_the_day: null });
  });
});

describe("add_book_collected mutation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("collects the listing and returns the joined row", async () => {
    const listingId = insertListing("Dune");

    const { data, errors } = await runOperation(
      addBookCollectedMutation(
        String(listingId),
        `
          id
          book_listing_id
          title
          authors
          completed
        `,
      ),
    );

    const row = db
      .prepare("SELECT id, book_listing_id FROM books_collected")
      .get() as { id: number; book_listing_id: number };

    expect(errors).toBeUndefined();
    expect(row.book_listing_id).toBe(listingId);
    expect(data).toEqual({
      add_book_collected: {
        id: String(row.id),
        book_listing_id: String(row.book_listing_id),
        title: "Dune",
        authors: "Dune Author",
        completed: false,
      },
    });
  });

  it("moves the listing out of Books Not Owned and into Books Owned", async () => {
    const listingId = insertListing("Dune");

    const before = await runQuery(listingsQuery());
    expect(
      connectionOf<{ title: string }>(before, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["Dune"]);

    await runQuery(addBookCollectedMutation(String(listingId)));

    const listings = await runQuery(listingsQuery());
    expect(connectionOf(listings, "book_listings").edges).toEqual([]);

    const collected = await runQuery(
      collectedQuery("", "book_listing_id title"),
    );
    expect(connectionOf(collected, "books_collected").edges).toEqual([
      {
        node: { book_listing_id: String(listingId), title: "Dune" },
        cursor: expect.any(String),
      },
    ]);
  });

  it.each(["abc", "1.5", "", "0", "-3"])(
    "rejects the invalid book_listing_id %o",
    async (bookListingId) => {
      const { data, errors } = await runOperation(
        addBookCollectedMutation(bookListingId),
      );

      expect(data).toBeNull();
      expect(errors?.[0]).toMatchObject({
        message: `Invalid book listing id: ${bookListingId}`,
        extensions: { code: "INVALID_BOOK_LISTING_ID" },
      });
    },
  );

  it("rejects a listing id that does not exist", async () => {
    const { data, errors } = await runOperation(
      addBookCollectedMutation("999999"),
    );

    expect(data).toBeNull();
    expect(errors?.[0]).toMatchObject({
      message: "Book listing 999999 was not found",
      extensions: { code: "BOOK_LISTING_NOT_FOUND" },
    });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM books_collected").get(),
    ).toEqual({ count: 0 });
  });

  it("rejects a listing that is already collected", async () => {
    const listingId = insertListing("Dune");
    insertCollected({ bookListingId: listingId }, "2026-01-01");

    const { data, errors } = await runOperation(
      addBookCollectedMutation(String(listingId)),
    );

    expect(data).toBeNull();
    expect(errors?.[0]).toMatchObject({
      message: `Book listing ${listingId} is already collected`,
      extensions: { code: "BOOK_ALREADY_COLLECTED" },
    });
    expect(db.prepare("SELECT id FROM books_collected").all()).toHaveLength(1);
  });

  it("surfaces unexpected errors from the database", async () => {
    const listingId = insertListing("Dune");
    vi.spyOn(db, "prepare").mockImplementationOnce(() => {
      throw new Error("database is unavailable");
    });

    const { data, errors } = await runOperation(
      addBookCollectedMutation(String(listingId)),
    );

    expect(data).toBeNull();
    expect(errors?.[0]?.message).toBe("database is unavailable");
    expect(errors?.[0]?.extensions?.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("remove_book_collected mutation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes the collected row and returns the joined fields", async () => {
    const listingId = insertListing("Dune");
    const collectedId = insertCollected(
      { bookListingId: listingId },
      "2026-01-01",
    );

    const { data, errors } = await runOperation(
      removeBookCollectedMutation(
        String(listingId),
        `
          id
          book_listing_id
          title
          authors
          completed
        `,
      ),
    );

    expect(errors).toBeUndefined();
    expect(data).toEqual({
      remove_book_collected: {
        id: String(collectedId),
        book_listing_id: String(listingId),
        title: "Dune",
        authors: "Dune Author",
        completed: false,
      },
    });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM books_collected").get(),
    ).toEqual({ count: 0 });
  });

  it("moves the book out of Books Owned and back into Books Not Owned", async () => {
    const listingId = insertListing("Dune");
    insertCollected({ bookListingId: listingId }, "2026-01-01");

    const added = await runQuery(collectedQuery("", "book_listing_id title"));
    expect(
      connectionOf<{ title: string }>(added, "books_collected").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["Dune"]);
    const hidden = await runQuery(listingsQuery());
    expect(connectionOf(hidden, "book_listings").edges).toEqual([]);

    await runQuery(removeBookCollectedMutation(String(listingId)));

    const collected = await runQuery(collectedQuery());
    expect(connectionOf(collected, "books_collected").edges).toEqual([]);

    const listings = await runQuery(listingsQuery());
    expect(
      connectionOf<{ title: string }>(listings, "book_listings").edges.map(
        (edge) => edge.node.title,
      ),
    ).toEqual(["Dune"]);
  });

  it.each(["abc", "1.5", "", "0", "-3"])(
    "rejects the invalid book_listing_id %o",
    async (bookListingId) => {
      const { data, errors } = await runOperation(
        removeBookCollectedMutation(bookListingId),
      );

      expect(data).toBeNull();
      expect(errors?.[0]).toMatchObject({
        message: `Invalid book listing id: ${bookListingId}`,
        extensions: { code: "INVALID_BOOK_LISTING_ID" },
      });
    },
  );

  it("rejects a listing that is not collected", async () => {
    const listingId = insertListing("Dune");

    const { data, errors } = await runOperation(
      removeBookCollectedMutation(String(listingId)),
    );

    expect(data).toBeNull();
    expect(errors?.[0]).toMatchObject({
      message: `Book listing ${listingId} is not collected`,
      extensions: { code: "BOOK_NOT_COLLECTED" },
    });
  });

  it("surfaces unexpected errors from the database", async () => {
    const listingId = insertListing("Dune");
    insertCollected({ bookListingId: listingId }, "2026-01-01");
    vi.spyOn(db, "prepare").mockImplementationOnce(() => {
      throw new Error("database is unavailable");
    });

    const { data, errors } = await runOperation(
      removeBookCollectedMutation(String(listingId)),
    );

    expect(data).toBeNull();
    expect(errors?.[0]?.message).toBe("database is unavailable");
    expect(errors?.[0]?.extensions?.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("update_book_progress mutation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores the progress and returns the joined row", async () => {
    const listingId = insertListing("Dune");
    insertCollected({ bookListingId: listingId }, "2026-01-01");

    const { data, errors } = await runOperation(
      updateBookProgressMutation(
        String(listingId),
        65,
        `
          id
          book_listing_id
          title
          authors
          completed
          progress
        `,
      ),
    );

    expect(errors).toBeUndefined();
    expect(data).toEqual({
      update_book_progress: {
        id: expect.any(String),
        book_listing_id: String(listingId),
        title: "Dune",
        authors: "Dune Author",
        completed: false,
        progress: 65,
      },
    });
  });

  it("completes the book at 100% and reopens it below", async () => {
    const listingId = insertListing("Dune");
    insertCollected({ bookListingId: listingId }, "2026-01-01");

    const finished = await runOperation(
      updateBookProgressMutation(String(listingId), 100, "completed progress"),
    );
    expect(finished.data).toEqual({
      update_book_progress: { completed: true, progress: 100 },
    });

    const reopened = await runOperation(
      updateBookProgressMutation(String(listingId), 99, "completed progress"),
    );
    expect(reopened.data).toEqual({
      update_book_progress: { completed: false, progress: 99 },
    });
  });

  it.each([-1, 101])(
    "rejects the out-of-range progress %i",
    async (progress) => {
      const listingId = insertListing("Dune");
      const collectedId = insertCollected(
        { bookListingId: listingId },
        "2026-01-01",
      );

      const { data, errors } = await runOperation(
        updateBookProgressMutation(String(listingId), progress),
      );

      expect(data).toBeNull();
      expect(errors?.[0]).toMatchObject({
        message: `Invalid progress: ${progress}`,
        extensions: { code: "INVALID_PROGRESS" },
      });
      expect(
        db
          .prepare("SELECT progress FROM books_collected WHERE id = ?")
          .get(collectedId),
      ).toEqual({ progress: 0 });
    },
  );

  it.each(["abc", "1.5", "", "0", "-3"])(
    "rejects the invalid book_listing_id %o",
    async (bookListingId) => {
      const { data, errors } = await runOperation(
        updateBookProgressMutation(bookListingId, 50),
      );

      expect(data).toBeNull();
      expect(errors?.[0]).toMatchObject({
        message: `Invalid book listing id: ${bookListingId}`,
        extensions: { code: "INVALID_BOOK_LISTING_ID" },
      });
    },
  );

  it("rejects a listing that is not collected", async () => {
    const listingId = insertListing("Dune");

    const { data, errors } = await runOperation(
      updateBookProgressMutation(String(listingId), 50),
    );

    expect(data).toBeNull();
    expect(errors?.[0]).toMatchObject({
      message: `Book listing ${listingId} is not collected`,
      extensions: { code: "BOOK_NOT_COLLECTED" },
    });
  });

  it("surfaces unexpected errors from the database", async () => {
    const listingId = insertListing("Dune");
    insertCollected({ bookListingId: listingId }, "2026-01-01");
    vi.spyOn(db, "prepare").mockImplementationOnce(() => {
      throw new Error("database is unavailable");
    });

    const { data, errors } = await runOperation(
      updateBookProgressMutation(String(listingId), 50),
    );

    expect(data).toBeNull();
    expect(errors?.[0]?.message).toBe("database is unavailable");
    expect(errors?.[0]?.extensions?.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
