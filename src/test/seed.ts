import db from "../data/database.ts";

/**
 * Inserts a book listing row directly rather than through `storeBook`, so tests
 * can set columns the scraper never writes (such as `does_own`).
 * @param {string} title - Title of the listing; also derives the other text fields
 * @param {{ doesOwn?: boolean }} [options] - Overrides for non-derived columns
 * @returns {number} The `id` of the inserted row
 */
export function insertListing(
  title: string,
  options: { doesOwn?: boolean } = {},
): number {
  const info = db
    .prepare(
      `INSERT INTO book_listings (title, authors, listing_url, does_own)
       VALUES (@title, @authors, @listing_url, @does_own)`,
    )
    .run({
      title,
      authors: `${title} Author`,
      listing_url: `/listings/${title}`,
      does_own: options.doesOwn ? 1 : 0,
    });

  return Number(info.lastInsertRowid);
}

/**
 * Inserts a collected row, which is owned either through a listing or through a
 * series, never both.
 * @param {{ bookListingId?: number, bookSeriesId?: number }} owner - The owning row
 * @param {string} datePurchased - Purchase date, used for ordering
 * @returns {number} The `id` of the inserted row
 */
export function insertCollected(
  owner: { bookListingId?: number; bookSeriesId?: number },
  datePurchased: string,
): number {
  const info = db
    .prepare(
      `INSERT INTO books_collected (book_listing_id, book_series_id, date_purchased)
       VALUES (@book_listing_id, @book_series_id, @date_purchased)`,
    )
    .run({
      book_listing_id: owner.bookListingId ?? null,
      book_series_id: owner.bookSeriesId ?? null,
      date_purchased: datePurchased,
    });

  return Number(info.lastInsertRowid);
}
