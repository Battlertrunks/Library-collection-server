import db from "../data/database.js";
import type { BookCollected } from "../model/BookCollected.ts";
import type { BookListing } from "../model/BookListing.js";

interface BookResolver {
  Query: object;
}

const bookResolver: BookResolver = {
  Query: {
    book_listings: () => {
      const query: string =
        "SELECT * FROM book_listings WHERE does_own = false";
      return db.prepare(query).all() as BookListing[];
    },
    books_collected: () => {
      const query: string = `
        SELECT bc.id, bc.book_listing_id, bc.date_purchased, bc.completed,
               bl.title, bl.authors, bl.thumbnail_url, bl.published_date
        FROM books_collected AS bc
        LEFT JOIN book_listings AS bl ON bl.id = bc.book_listing_id
        ORDER BY bc.date_purchased DESC, bc.id DESC
      `;
      return db.prepare(query).all() as BookCollected[];
    },
  },
};

export default bookResolver;
