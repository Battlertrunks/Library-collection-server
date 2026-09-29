import { ApolloServer } from "@apollo/server";
import { describe, expect, it } from "vitest";
import db from "../data/database.ts";
import { typeDefs } from "../schemas/typeDefs.ts";
import { insertCollected, insertListing } from "../test/seed.ts";
import resolvers from "./resolvers.ts";

const server = new ApolloServer({ typeDefs, resolvers });

/** Runs a query, failing loudly on GraphQL errors instead of returning them. */
async function runQuery(query: string): Promise<Record<string, unknown>> {
  const result = await server.executeOperation({ query });

  if (result.body.kind !== "single") {
    throw new Error("Expected a single GraphQL response");
  }

  const { errors, data } = result.body.singleResult;

  if (errors?.length) {
    throw new Error(errors[0]?.message ?? "GraphQL query failed");
  }

  return data ?? {};
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
