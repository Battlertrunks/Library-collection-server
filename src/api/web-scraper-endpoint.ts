import Express from "express";
import puppeteer from "puppeteer";
import { getBooks, storeBook } from "../modules/scrap-elements.js";
const router = Express.Router();

export type BookListing = {
  title:            string;
  price:            string;
  thumbnail_url:    string;
  listing_url:      string;
  description:      string;
}

export type BookListings = Array<BookListing>;

// Will run rarely as this will be to store data to the database without scraping repeatedly
// TODO: Setup a cron job and make behavior to not add books already in database. Look for new books
router.post("/", async (req, res): Promise<Express.Response> => {
  const allBooks: BookListings = []

  try {
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

    const bookPages: Array<string> | undefined = process.env.BOOKS_API_ENDPOINT?.split(",");
    if (!bookPages) return res.sendStatus(404);

    for (const endpoint of bookPages) {
       await page.goto(`${endpoint}${process.env.SUB_PATH}`);
       allBooks.push(...(await getBooks(page)));
    }

    await browser.close();
  } catch(error: any) {
    return res.status(500).send("Unable to retrieve data: " + error.message);
  }

  const timeout = async (delay: number) => await new Promise(res => setTimeout(res, delay));

  // Easier alternative to get the book cover thumbnail to lessen web scraping
  for (const [i, book] of allBooks.entries()) {
    try {
      const params: URLSearchParams = new URLSearchParams();
      params.append("q", process.env.SERIES + " " + book.title)
      const url: string = `https://www.googleapis.com/books/v1/volumes?${
       params.toString()
      }`;

      const response: Response = await fetch(url);
      if (!response.ok) throw new Error("Failed to get response from 'googleapis'");

      const result: any = await response.json();
      
      // Add the domain name to the link
      book.listing_url = process.env.SITE_PAGE + book.listing_url;

      // No results, skip the rest of the logic
      if (!result?.items?.length) {
        await timeout(61000); // ms
        continue;
      }

      // If there are results, the top one will most likely be the data needed.
      // Will think of a better implementation later possibly
      book.thumbnail_url = result?.items[0]?.volumeInfo?.imageLinks?.thumbnail;
      book.description = result?.items[0]?.volumeInfo?.description

      console.log(`Completed book ${i+1} of ${allBooks.length}`);

      storeBook(book);

      break;
      
      await timeout(61000); // ms
    }  catch (error) {
      return res.sendStatus(500);
    }
  };

  return res.status(201).send(JSON.stringify(allBooks));
})

export default router;
