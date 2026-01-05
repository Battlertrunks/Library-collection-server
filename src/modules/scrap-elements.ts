import type { Page } from "puppeteer";
import db from "../data/database.js"
import type { Statement } from "better-sqlite3";
import { type BookListing, type BookListings } from "../api/web-scraper-endpoint.js";
import 'dotenv/config';

export async function getBooks(page: Page): Promise<BookListings> {
   return await page.$$eval(".product-container", (elements: Element[]) => {
    return elements.map((el: Element) => {
      const title: string = el.querySelector('.title-container')?.textContent.trim() || "";
      const price: string = el.querySelector("span")?.textContent.trim() || "";
      
      // We can store the link to the official page of the book
      const listing_url: string = el.querySelector("a")?.getAttribute("href") || ""
      
      return { title, price, thumbnail_url: "", listing_url, description: "" };
    });
  })
}

/**
 * Store the desired book data into the database
 * @param {BookListing} book - The book being stored to the database
 */
export function storeBook(book: BookListing): void {
  try {
    if (book === null || typeof book !== "object" || Array.isArray(book)) {
      throw new Error("storeBooks: Incorrect parameter type passed through");
    }

    const insert: Statement = db.prepare(`
      INSERT INTO book_listings (title, price, thumbnail_url, listing_url, description)
        VALUES (@title, @price, @thumbnail_url, @listing_url, @description);
    `);

    insert.run(book)
  } catch (error: any) {
    throw new Error("Could not store book to database:", error.message);
  }
}
