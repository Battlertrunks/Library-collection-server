import { GraphQLError } from "graphql";
import db from "../data/database.js";
import type { BookCollected } from "../model/BookCollected.ts";
import type { BookListing } from "../model/BookListing.js";

/** Shared listing join so the query and mutation row shapes cannot drift. */
const collectedBookSelect: string = `
  SELECT bc.id, bc.book_listing_id, bc.date_purchased, bc.completed,
         bl.title, bl.authors, bl.thumbnail_url, bl.published_date
  FROM books_collected AS bc
  LEFT JOIN book_listings AS bl ON bl.id = bc.book_listing_id
`;

interface AddBookCollectedArgs {
  book_listing_id: string;
}

interface BookResolver {
  Query: object;
  Mutation: object;
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
        ${collectedBookSelect}
        ORDER BY bc.date_purchased DESC, bc.id DESC
      `;
      return db.prepare(query).all() as BookCollected[];
    },
  },
  Mutation: {
    add_book_collected: (
      _parent: unknown,
      { book_listing_id }: AddBookCollectedArgs,
    ): BookCollected => {
      const listingId: number = Number(book_listing_id);

      if (!Number.isSafeInteger(listingId) || listingId <= 0) {
        throw new GraphQLError(`Invalid book listing id: ${book_listing_id}`, {
          extensions: { code: "INVALID_BOOK_LISTING_ID" },
        });
      }

      const listing: unknown = db
        .prepare("SELECT id FROM book_listings WHERE id = ?")
        .get(listingId);

      if (!listing) {
        throw new GraphQLError(`Book listing ${listingId} was not found`, {
          extensions: { code: "BOOK_LISTING_NOT_FOUND" },
        });
      }

      const collected: unknown = db
        .prepare("SELECT id FROM books_collected WHERE book_listing_id = ?")
        .get(listingId);

      if (collected) {
        throw new GraphQLError(
          `Book listing ${listingId} is already collected`,
          { extensions: { code: "BOOK_ALREADY_COLLECTED" } },
        );
      }

      const insert = db
        .prepare("INSERT INTO books_collected (book_listing_id) VALUES (?)")
        .run(listingId);

      const query: string = `${collectedBookSelect} WHERE bc.id = ?`;
      return db
        .prepare(query)
        .get(Number(insert.lastInsertRowid)) as BookCollected;
    },
  },
};

export default bookResolver;
