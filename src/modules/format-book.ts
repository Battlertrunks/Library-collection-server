import type { BookListing, GoogleBooksResponse } from "../model/BookListing.js";

export function formatBook(
  book: BookListing,
  result: GoogleBooksResponse,
): BookListing {
  // Add the domain name to the link
  book.listing_url = process.env.SITE_PAGE + book.listing_url;

  const pubDate = result?.items?.[0]?.volumeInfo?.publishedDate;

  book.authors =
    result?.items?.[0]?.volumeInfo?.authors?.join(",") || "COULD NOT FIND";
  book.thumbnail_url =
    result?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail || null; // use a placeholder image?
  book.description = result?.items?.[0]?.volumeInfo?.description || null;
  book.published_date = pubDate ? new Date(pubDate).toISOString() : null;
  book.genres = result?.items?.[0]?.volumeInfo?.categories?.join(",") || null;

  return book;
}
