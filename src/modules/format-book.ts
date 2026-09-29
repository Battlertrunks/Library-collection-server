import type { BookListing, GoogleBooksResponse } from "../model/BookListing.js";

export function formatBook(
  book: BookListing,
  result: GoogleBooksResponse,
): BookListing {
  const volumeInfo = result?.items?.[0]?.volumeInfo;
  const pubDate = volumeInfo?.publishedDate;

  return {
    ...book,
    // Add the domain name to the link
    listing_url: process.env.SITE_PAGE + book.listing_url,
    authors: volumeInfo?.authors?.join(",") || "COULD NOT FIND",
    thumbnail_url: volumeInfo?.imageLinks?.thumbnail || null, // use a placeholder image?
    description: volumeInfo?.description || null,
    published_date: pubDate ? new Date(pubDate).toISOString() : null,
    genres: volumeInfo?.categories?.join(",") || null,
  };
}
