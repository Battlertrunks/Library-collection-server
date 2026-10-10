import db from "../data/database.ts";
import type { BookCollected } from "../model/BookCollected.ts";
import { collectedBookSelect } from "./book-pagination.ts";

/** Milliseconds in one calendar day. */
const MS_PER_DAY: number = 24 * 60 * 60 * 1000;

/**
 * Converts an instant to its local calendar day, counted in days since the
 * Unix epoch, so the featured book changes at the server's local midnight.
 * @param date The instant to convert.
 * @returns The local day number.
 */
function localDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY,
  );
}

/**
 * Picks the Book of the Day from owned books that are not yet finished.
 * The pick is deterministic for a local calendar day: the pool is ordered by
 * collected row id and the day number selects one entry, rotating through the
 * pool as days pass. Adding or removing unfinished books reshuffles which book
 * each future day maps to.
 * @param now The instant to pick for; injectable so tests can pin dates.
 * @returns The featured collected book, or null when nothing is unfinished.
 */
export function fetchBookOfTheDay(
  now: Date = new Date(),
): BookCollected | null {
  const { count } = db
    .prepare(
      `SELECT COUNT(*) AS count FROM books_collected
        WHERE book_listing_id IS NOT NULL AND completed = 0`,
    )
    .get() as { count: number };

  if (count === 0) {
    return null;
  }

  const row = db
    .prepare(
      `${collectedBookSelect}
        WHERE bc.book_listing_id IS NOT NULL AND bc.completed = 0
        ORDER BY bc.id ASC
        LIMIT 1 OFFSET @offset`,
    )
    .get({ offset: localDayNumber(now) % count }) as BookCollected | undefined;

  return row ?? null;
}
