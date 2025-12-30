import type { Page } from "puppeteer";
import db from "../data/database.js"
import type { Statement } from "better-sqlite3";
import { type BookListings } from "../api/web-scraper-endpoint.js";
import 'dotenv/config';

export async function getBooks(page: Page): Promise<BookListings> {
   return await page.$$eval(".product-container", (elements: Element[]) => {
    return elements.map((el: Element) => {
      const title: string = el.querySelector('.title-container')?.textContent.trim() || "";
      const price: string = el.querySelector("span")?.textContent.trim() || "";
      
      // We can store the image thumbnail by using the domain name and adding onto the image path from the scrapped site
      const thumbnail_url: string = `${!process.env.SITE_PAGE}${el.querySelector("img")?.getAttribute("data-original")}`;
      const listing_url: string = `${!process.env.SITE_PAGE}${el.querySelector("a")?.getAttribute("href")}`
      
      return { title, price, thumbnail_url, listing_url, header: "", body: "" };
    });
  })
}

export async function storeBooks(books: BookListings) {
  try {
    if (!Array.isArray(books) || !books.length) {
      throw new Error("Unable to save books to database");
    }

    const insert: Statement = db.prepare(`
      INSERT INTO book_listings (title, summary, price, thumbnail_url, listing_url)
        VALUES (@title, @summary, @price, @thumbnail_url, @listing_url);
    `);

    const insertMany = db.transaction((books) => {
      for (const book of books) {
        console.log(book);
        insert.run(book);
        break;
      }
    })

    insertMany(books);
  } catch (error: any) {
    throw new Error("Could not store book to database:", error);
  }
}
