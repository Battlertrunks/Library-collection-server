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

/** Builds the add_book_collected mutation, defaulting to selecting its `id`. */
function addBookCollectedMutation(
  bookListingId: string,
  fields: string = "id",
): string {
  return `mutation {
    add_book_collected(book_listing_id: "${bookListingId}") { ${fields} }
  }`;
}

describe("book_listings query", () => {
  it("returns only listings that are not owned yet", async () => {
    insertListing("The Hobbit");
    insertListing("The Silmarillion", { doesOwn: true });

    const data = await runQuery("{ book_listings { title } }");

    expect(data).toEqual({ book_listings: [{ title: "The Hobbit" }] });
  });
});

describe("books_collected query", () => {
  it("joins the listing fields of collected books", async () => {
    const listingId = insertListing("Dune");
    db.prepare(
      `UPDATE book_listings
          SET thumbnail_url = 'https://covers.example/dune.jpg',
              published_date = '1965-08-01'
        WHERE id = ?`,
    ).run(listingId);
    const collectedId = insertCollected(
      { bookListingId: listingId },
      "2026-01-01",
    );

    const data = await runQuery(`{
      books_collected {
        id
        book_listing_id
        title
        authors
        thumbnail_url
        published_date
        completed
      }
    }`);

    expect(data).toEqual({
      books_collected: [
        {
          id: String(collectedId),
          book_listing_id: String(listingId),
          title: "Dune",
          authors: "Dune Author",
          thumbnail_url: "https://covers.example/dune.jpg",
          published_date: "1965-08-01",
          completed: false,
        },
      ],
    });
  });

  it("returns null listing fields for series-owned entries", async () => {
    db.prepare("INSERT INTO series_collected (name) VALUES ('A Series')").run();
    const series = db
      .prepare("SELECT id FROM series_collected")
      .get() as { id: number };
    const collectedId = insertCollected(
      { bookSeriesId: series.id },
      "2026-02-01",
    );

    const data = await runQuery(
      "{ books_collected { id book_listing_id title authors } }",
    );

    expect(data).toEqual({
      books_collected: [
        {
          id: String(collectedId),
          book_listing_id: null,
          title: null,
          authors: null,
        },
      ],
    });
  });

  it("orders entries by purchase date desc, then id desc", async () => {
    const oldest = insertCollected({}, "2026-01-01");
    const earlierTie = insertCollected({}, "2026-02-01");
    const laterTie = insertCollected({}, "2026-02-01");

    const data = await runQuery("{ books_collected { id } }");

    expect(data).toEqual({
      books_collected: [
        { id: String(laterTie) },
        { id: String(earlierTie) },
        { id: String(oldest) },
      ],
    });
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
