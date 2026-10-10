import { GraphQLError } from "graphql";
import db from "../data/database.js";
import type { BookCollected } from "../model/BookCollected.ts";
import { fetchBookOfTheDay } from "../modules/book-of-the-day.ts";
import {
  collectedBookSelect,
  fetchBookListingsPage,
  fetchBooksCollectedPage,
  type PageArgs,
} from "../modules/book-pagination.ts";

interface BookListingIdArgs {
  book_listing_id: string;
}

interface UpdateBookProgressArgs {
  book_listing_id: string;
  progress: number;
}

/** Highest valid reading progress, at which a book counts as completed. */
const MAX_PROGRESS: number = 100;

interface BookResolver {
  Query: object;
  Mutation: object;
}

/**
 * Parses a `book_listing_id` GraphQL argument, rejecting anything that is not
 * a positive integer.
 * @param rawId The raw argument value.
 * @returns The parsed listing id.
 */
function parseBookListingId(rawId: string): number {
  const listingId: number = Number(rawId);

  if (!Number.isInteger(listingId) || listingId <= 0) {
    throw new GraphQLError(`Invalid book listing id: ${rawId}`, {
      extensions: { code: "INVALID_BOOK_LISTING_ID" },
    });
  }

  return listingId;
}

const bookResolver: BookResolver = {
  Query: {
    book_listings: (_parent: unknown, args: PageArgs) =>
      fetchBookListingsPage(args),
    books_collected: (_parent: unknown, args: PageArgs) =>
      fetchBooksCollectedPage(args),
    book_of_the_day: (): BookCollected | null => fetchBookOfTheDay(),
  },
  Mutation: {
    add_book_collected: (
      _parent: unknown,
      { book_listing_id }: BookListingIdArgs,
    ): BookCollected => {
      const listingId: number = parseBookListingId(book_listing_id);

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
    remove_book_collected: (
      _parent: unknown,
      { book_listing_id }: BookListingIdArgs,
    ): BookCollected => {
      const listingId: number = parseBookListingId(book_listing_id);

      const collected = db
        .prepare(`${collectedBookSelect} WHERE bc.book_listing_id = ?`)
        .get(listingId) as BookCollected | undefined;

      if (!collected) {
        throw new GraphQLError(`Book listing ${listingId} is not collected`, {
          extensions: { code: "BOOK_NOT_COLLECTED" },
        });
      }

      db.prepare("DELETE FROM books_collected WHERE id = ?").run(collected.id);

      return collected;
    },
    update_book_progress: (
      _parent: unknown,
      { book_listing_id, progress }: UpdateBookProgressArgs,
    ): BookCollected => {
      const listingId: number = parseBookListingId(book_listing_id);

      if (
        !Number.isInteger(progress) ||
        progress < 0 ||
        progress > MAX_PROGRESS
      ) {
        throw new GraphQLError(`Invalid progress: ${progress}`, {
          extensions: { code: "INVALID_PROGRESS" },
        });
      }

      const collected = db
        .prepare(`${collectedBookSelect} WHERE bc.book_listing_id = ?`)
        .get(listingId) as BookCollected | undefined;

      if (!collected) {
        throw new GraphQLError(`Book listing ${listingId} is not collected`, {
          extensions: { code: "BOOK_NOT_COLLECTED" },
        });
      }

      // Progress is the source of truth for the finished flag: hitting 100%
      // completes the book, moving back below it reopens it.
      db.prepare(
        `UPDATE books_collected
            SET progress = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
      ).run(progress, progress >= MAX_PROGRESS ? 1 : 0, collected.id);

      return db
        .prepare(`${collectedBookSelect} WHERE bc.id = ?`)
        .get(collected.id) as BookCollected;
    },
  },
};

export default bookResolver;
