import { beforeEach, describe, expect, it } from "vitest";
import db from "../data/database.ts";
import { makeBookListing } from "../test/book-listing.ts";
import { resetTestDatabase } from "../test/database.ts";
import { checkIfBookExists, storeBook } from "./get-and-set-books.ts";

describe("storeBook", () => {
  beforeEach(() => {
    resetTestDatabase(db);
  });

  it("persists every field of a listing", () => {
    const book = makeBookListing({
      title: "Dune",
      authors: "Frank Herbert",
      thumbnail_url: "https://covers.example/dune.jpg",
      listing_url: "/dune",
      description: "On a desert planet.",
      published_date: "1965-08-01T00:00:00.000Z",
      genres: "Science Fiction",
    });

    storeBook(book);

    const row: unknown = db
      .prepare(
        `SELECT title, authors, thumbnail_url, listing_url,
                description, published_date, genres
           FROM book_listings
          WHERE title = @title`,
      )
      .get({ title: "Dune" });

    expect(row).toEqual({
      title: "Dune",
      authors: "Frank Herbert",
      thumbnail_url: "https://covers.example/dune.jpg",
      listing_url: "/dune",
      description: "On a desert planet.",
      published_date: "1965-08-01T00:00:00.000Z",
      genres: "Science Fiction",
    });
  });

  it("stores nulls for fields Google Books could not provide", () => {
    storeBook(
      makeBookListing({
        title: "Unknown Cover",
        thumbnail_url: null,
        description: null,
        genres: null,
      }),
    );

    const row: unknown = db
      .prepare(
        `SELECT thumbnail_url, description, published_date, genres
           FROM book_listings
          WHERE title = ?`,
      )
      .get("Unknown Cover");

    expect(row).toEqual({
      thumbnail_url: null,
      description: null,
      published_date: null,
      genres: null,
    });
  });

  it("preserves the underlying database error as the cause", () => {
    const invalid = makeBookListing({ title: null as unknown as string });

    let thrown: unknown;
    try {
      storeBook(invalid);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe("Could not store book to database");
    expect(error.cause).toBeInstanceOf(Error);
    expect((error.cause as Error).message).toContain(
      "NOT NULL constraint failed",
    );
  });
});

describe("checkIfBookExists", () => {
  beforeEach(() => {
    resetTestDatabase(db);
  });

  it("returns true for a title that was stored", () => {
    storeBook(makeBookListing({ title: "Dune" }));

    expect(checkIfBookExists(makeBookListing({ title: "Dune" }))).toBe(true);
  });

  it("returns false for an unknown title", () => {
    expect(checkIfBookExists(makeBookListing({ title: "Neuromancer" }))).toBe(
      false,
    );
  });

  it("returns false for a blank title", () => {
    expect(checkIfBookExists(makeBookListing({ title: "" }))).toBe(false);
  });
});
