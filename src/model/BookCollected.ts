/**
 * A row from `books_collected` joined with its `book_listings` entry.
 * Listing fields are nullable because the join is a LEFT JOIN — rows owned
 * via a series (`book_series_id`) have no listing to join.
 */
export type BookCollected = {
  id: number;
  book_listing_id: number | null;
  date_purchased: string;
  completed: number;
  title: string | null;
  authors: string | null;
  thumbnail_url: string | null;
  published_date: string | null;
};
