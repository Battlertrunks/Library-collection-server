import db from "../data/database.ts";

/** Overrides for listing columns the scraper normally derives. */
export type InsertListingOptions = {
  doesOwn?: boolean;
  createdAt?: string;
  publishedDate?: string;
  authors?: string;
};

/**
 * Inserts a book listing row directly rather than through `storeBook`, so tests
 * can set columns the scraper never writes (such as `does_own`) and pin the
 * sortable timestamps (`created_at`, `published_date`).
 * @param {string} title - Title of the listing; also derives the other text fields
 * @param {InsertListingOptions} [options] - Overrides for non-derived columns
 * @returns {number} The `id` of the inserted row
 */
export function insertListing(
  title: string,
  options: InsertListingOptions = {},
): number {
  const info = db
    .prepare(
      `INSERT INTO book_listings
         (title, authors, listing_url, does_own, created_at, published_date)
       VALUES
         (@title, @authors, @listing_url, @does_own,
          COALESCE(@created_at, CURRENT_TIMESTAMP), @published_date)`,
    )
    .run({
      title,
      authors: options.authors ?? `${title} Author`,
      listing_url: `/listings/${title}`,
      does_own: options.doesOwn ? 1 : 0,
      created_at: options.createdAt ?? null,
      published_date: options.publishedDate ?? null,
    });

  return Number(info.lastInsertRowid);
}

/**
 * Inserts a collected row, which is owned either through a listing or through a
 * series, never both.
 * @param {{ bookListingId?: number, bookSeriesId?: number }} owner - The owning row
 * @param {string} datePurchased - Purchase date, used for ordering
 * @param {boolean} [completed] - Whether the book has been read
 * @returns {number} The `id` of the inserted row
 */
export function insertCollected(
  owner: { bookListingId?: number; bookSeriesId?: number },
  datePurchased: string,
  completed: boolean = false,
): number {
  const info = db
    .prepare(
      `INSERT INTO books_collected
         (book_listing_id, book_series_id, date_purchased, completed)
       VALUES
         (@book_listing_id, @book_series_id, @date_purchased, @completed)`,
    )
    .run({
      book_listing_id: owner.bookListingId ?? null,
      book_series_id: owner.bookSeriesId ?? null,
      date_purchased: datePurchased,
      completed: completed ? 1 : 0,
    });

  return Number(info.lastInsertRowid);
}
