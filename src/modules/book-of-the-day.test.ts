import { describe, expect, it } from "vitest";
import { fetchBookOfTheDay } from "./book-of-the-day.ts";
import { insertCollected, insertListing } from "../test/seed.ts";

/** Collects a listing and returns the collected row id. */
function collect(title: string, completed: boolean = false): number {
  const listingId = insertListing(title);
  return insertCollected({ bookListingId: listingId }, "2026-01-01", completed);
}

describe("fetchBookOfTheDay", () => {
  it("returns null when nothing is unfinished", () => {
    collect("Finished", true);

    expect(fetchBookOfTheDay(new Date(2026, 0, 15, 12))).toBeNull();
  });

  it("returns null when only series-owned rows exist", () => {
    insertCollected({}, "2026-01-01");

    expect(fetchBookOfTheDay(new Date(2026, 0, 15, 12))).toBeNull();
  });

  it("picks from unfinished owned books and keeps the pick all day", () => {
    const alpha = collect("Alpha");
    collect("Finished", true);
    const bravo = collect("Bravo");

    const morning = fetchBookOfTheDay(new Date(2026, 0, 15, 0, 1));
    const evening = fetchBookOfTheDay(new Date(2026, 0, 15, 23, 59));

    expect([alpha, bravo]).toContain(morning?.id);
    expect(evening?.id).toBe(morning?.id);
  });

  it("rotates one book per local day and wraps around", () => {
    collect("Alpha");
    collect("Bravo");
    collect("Charlie");

    const picks = [0, 1, 2, 3].map(
      (offset) => fetchBookOfTheDay(new Date(2026, 0, 15 + offset, 12))?.title,
    );

    expect(new Set(picks.slice(0, 3)).size).toBe(3);
    expect(picks[3]).toBe(picks[0]);
  });
});
