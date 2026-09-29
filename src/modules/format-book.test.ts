import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleBooksResponse } from "../model/BookListing.ts";
import { makeBookListing } from "../test/book-listing.ts";
import { formatBook } from "./format-book.ts";

const SITE_PAGE = "https://books.example";

describe("formatBook", () => {
  beforeEach(() => {
    vi.stubEnv("SITE_PAGE", SITE_PAGE);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps the Google Books volume onto the listing", () => {
    const result: GoogleBooksResponse = {
      items: [
        {
          volumeInfo: {
            authors: ["Jane Doe", "John Roe"],
            imageLinks: { thumbnail: "https://covers.example/book.jpg" },
            description: "A story about testing.",
            categories: ["Fiction", "Adventure"],
            publishedDate: "2019-11-05",
          },
        },
      ],
    };

    const formatted = formatBook(
      makeBookListing({ listing_url: "/mapped" }),
      result,
    );

    expect(formatted).toEqual({
      title: "The Fellowship of the Ring",
      authors: "Jane Doe,John Roe",
      thumbnail_url: "https://covers.example/book.jpg",
      listing_url: `${SITE_PAGE}/mapped`,
      description: "A story about testing.",
      published_date: "2019-11-05T00:00:00.000Z",
      genres: "Fiction,Adventure",
    });
  });

  it("falls back when Google Books returns no volume", () => {
    const formatted = formatBook(
      makeBookListing({ listing_url: "/missing" }),
      {},
    );

    expect(formatted).toEqual({
      title: "The Fellowship of the Ring",
      authors: "COULD NOT FIND",
      thumbnail_url: null,
      listing_url: `${SITE_PAGE}/missing`,
      description: null,
      published_date: null,
      genres: null,
    });
  });

  it("accepts a year-only published date", () => {
    const result: GoogleBooksResponse = {
      items: [{ volumeInfo: { publishedDate: "1954" } }],
    };

    const formatted = formatBook(makeBookListing(), result);

    expect(formatted.published_date).toBe("1954-01-01T00:00:00.000Z");
  });

  it("does not mutate the listing it was given", () => {
    const book = makeBookListing();
    const original = { ...book };

    const formatted = formatBook(book, {
      items: [
        {
          volumeInfo: {
            authors: ["Jane Doe"],
            publishedDate: "2019-11-05",
          },
        },
      ],
    });

    expect(book).toEqual(original);
    expect(formatted).not.toBe(book);
  });
});
