import { GraphQLError } from "graphql";
import db from "../data/database.js";
import type { BookCollected } from "../model/BookCollected.ts";
import {
  collectedBookSelect,
  fetchBookListingsPage,
  fetchBooksCollectedPage,
  type PageArgs,
} from "../modules/book-pagination.ts";

interface AddBookCollectedArgs {
  book_listing_id: string;
}

interface BookResolver {
  Query: object;
  Mutation: object;
}

const bookResolver: BookResolver = {
  Query: {
    book_listings: (_parent: unknown, args: PageArgs) =>
      fetchBookListingsPage(args),
    books_collected: (_parent: unknown, args: PageArgs) =>
      fetchBooksCollectedPage(args),
  },
  Mutation: {
    add_book_collected: (
      _parent: unknown,
      { book_listing_id }: AddBookCollectedArgs,
    ): BookCollected => {
      const listingId: number = Number(book_listing_id);

      if (!Number.isInteger(listingId) || listingId <= 0) {
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
