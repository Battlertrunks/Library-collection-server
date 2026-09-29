import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db from "../../data/database.ts";
import { makeBookListing } from "../../test/book-listing.ts";
import { requestBookInfo } from "./retrieves-books.ts";

// The scraper itself is not involved: `requestBookInfo` only enriches listings
// it is handed, and launching a browser in a test would be slow and unsafe.
vi.mock("puppeteer", () => ({ default: { launch: vi.fn() } }));

const SITE_PAGE = "https://books.example";

const googleBooksResult = {
  items: [
    {
      volumeInfo: {
        authors: ["Frank Herbert"],
        publishedDate: "1965-08-01",
      },
    },
  ],
};

describe("requestBookInfo", () => {
  beforeEach(() => {
    vi.stubEnv("SITE_PAGE", SITE_PAGE);
    vi.stubEnv("SERIES", "Dune");
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "test-key");
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(googleBooksResult), { status: 200 }),
      ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the listings enriched with the Google Books fields", async () => {
    const books = [
      makeBookListing({ title: "Dune", listing_url: "/dune", authors: "" }),
    ];

    const pending = requestBookInfo(books);
    await vi.runAllTimersAsync();
    const formatted = await pending;

    expect(formatted[0]?.listing_url).toBe(`${SITE_PAGE}/dune`);
    expect(formatted[0]?.authors).toBe("Frank Herbert");
    expect(formatted[0]?.published_date).toBe("1965-08-01T00:00:00.000Z");
  });

  it("persists the enriched listing", async () => {
    const pending = requestBookInfo([
      makeBookListing({ title: "Dune", listing_url: "/dune", authors: "" }),
    ]);
    await vi.runAllTimersAsync();
    await pending;

    const row: unknown = db
      .prepare("SELECT authors, listing_url FROM book_listings")
      .get();

    expect(row).toEqual({
      authors: "Frank Herbert",
      listing_url: `${SITE_PAGE}/dune`,
    });
  });
});
