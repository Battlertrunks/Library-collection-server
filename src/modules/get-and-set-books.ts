import type { Page } from "puppeteer";
import db from "../data/database";
import type { Statement } from "better-sqlite3";
import { type BookListing, type BookListings } from "../model/BookListing";
import "dotenv/config";

export async function getBooks(page: Page): Promise<BookListings> {
  return await page.$$eval(".product-container", (elements: Element[]) => {
    return elements.map((el: Element) => {
      const title: string =
        el.querySelector(".title-container")?.textContent.trim() || "";

      // We can store the link to the official page of the book
      const listing_url: string =
        el.querySelector("a")?.getAttribute("href") || "";

      return {
        title,
        authors: "",
        thumbnail_url: "",
        listing_url,
        description: "",
        published_date: null,
        genres: "",
      };
    });
  });
}

/**
 * Store the desired book data into the database
 * @param {BookListing} book - The book being stored to the database
 */
export function storeBook(book: BookListing): void {
  try {
    const insert: Statement = db.prepare(`
      INSERT INTO book_listings (title, authors, thumbnail_url, listing_url, description, published_date, genres)
        VALUES (@title, @authors, @thumbnail_url, @listing_url, @description, @published_date, @genres);
    `);

    insert.run(book);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error("Could not store book to database", { cause: error });
    } else {
      throw new Error("Unknown error occurred", { cause: error });
    }
  }
}

export function checkIfBookExists(book: BookListing): boolean {
  if (!book.title) return false; // if no title, then no legit book

  const row: unknown = db
    .prepare("SELECT * FROM book_listings WHERE title = ?")
    .get(book.title);
  return !!row;
}
