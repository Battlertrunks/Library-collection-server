import Express from "express";
import puppeteer from "puppeteer";
import { getBooks, storeBooks } from "../modules/scrap-elements.js";
import * as cheerio from 'cheerio';
const router = Express.Router();

export type BookListings = Array<{
  title:            string;
  price:            string;
  thumbnail_url:    string;
  listing_url:      string;
  header:           string;
  body:             string;
}>;

// Will run rarely as this will be to store data to the database without scraping
// TODO: Setup a cron job and make behavior to not add books already in database. Look for new books
router.post("/", async (req, res): Promise<Express.Response> => {
  // You leave me no choice with your hidden APIs...
  const browser: puppeteer.Browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-gpu"]
  });
  const page: puppeteer.Page = await browser.newPage();

  // To save some time, we do not need the CSS and images to load for the scraper.
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.resourceType() === "image" || req.resourceType() === "stylesheet") {
      req.abort();
    } else {
      req.continue();
    }
  });

  // The wait is going to be undesirable for 2-8 seconds. We should cache this in a store later on if that makes sense for the 
  // frontend!

  await page.goto(`${process.env.BOOKS_API_ENDPOINT}/novels?showall=1`);

  const thirtyKBooks: BookListings = await getBooks(page);

  // next series
  await page.goto(`${process.env.BOOKS_API_ENDPOINT_PAGINATED}/novels?page=1`);

  const sleep = (ms: number): Promise<void> => new Promise(res => setTimeout(res, ms));
  
  let pageNumber: number = 1;
  const fortyKBooks: BookListings = []
  while (true) {
    const books = await getBooks(page);

    if (!!!books.length) break; // no more books, break out of the loop

    fortyKBooks.push(...books);
    
    sleep(2000); // Prevent frequent loads as to not overload their site
    await page.goto(`/novels?page=${++pageNumber}`);
  }
  
  const allBooks: BookListings = thirtyKBooks.concat(fortyKBooks);

  await browser.close();

  // await storeBooks(allBooks);

  return res.status(201).send(JSON.stringify(allBooks));
})

export default router;
