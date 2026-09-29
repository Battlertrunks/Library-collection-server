import type { BookListing } from "../model/BookListing.ts";

/** Builds a valid book listing, with overrides for test-specific fields. */
export function makeBookListing(
  overrides: Partial<BookListing> = {},
): BookListing {
  return {
    title: "The Fellowship of the Ring",
    authors: "",
    thumbnail_url: "",
    listing_url: "/the-fellowship-of-the-ring",
    description: "",
    published_date: null,
    genres: "",
    ...overrides,
  };
}
