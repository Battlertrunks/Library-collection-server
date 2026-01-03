import Express from "express";
import puppeteer from "puppeteer";
import { getBooks, storeBooks } from "../modules/scrap-elements.js";
const router = Express.Router();

export type BookListings = Array<{
  title:            string;
  price:            string;
  thumbnail_url:    string;
  listing_url:      string;
  body:             string;
}>;

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
    console.log(bookPages);
    if (!bookPages) return res.sendStatus(404);

    for (const endpoint of bookPages) {
       console.log("pre goto");
       await page.goto(`${endpoint}${process.env.SUB_PATH}`);
       console.log("post goto")
       allBooks.push(...(await getBooks(page)));
       console.log(allBooks?.length)
    }

    await browser.close();
  } catch(error: any) {
    console.log(error);
    return res.status(500).send("Unable to retrieve data: " + error.message);
  }

  const timeout = async (delay: number) => await new Promise(res => setTimeout(res, delay));

  // Easier alternative to get the book cover thumbnail to lessen web scraping
  for (const book of allBooks) {
    try {
      const url: string = `https://www.googleapis.com/books/v1/volumes?q=${
       process.env.SERIES + "+" + book.title.replaceAll(" ", "+")
      }`;

      console.log(url);
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
      book.body = result?.items[0]?.volumeInfo?.description
      
      await timeout(61000); // ms
    }  catch (error) {
      console.log(error);
      return res.sendStatus(500);
    }
  };

  try {
    await storeBooks(allBooks);
  } catch(error: any) {
    return res.status(500).send(error?.message || "Unable to store books to database");
  }

  return res.status(201).send(JSON.stringify(allBooks));
})

export default router;
