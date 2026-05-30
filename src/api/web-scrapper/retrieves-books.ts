import {
  type BookListing,
  type BookListings,
  type GoogleBooksResponse,
} from "../../model/BookListing.ts";
import { Router, type Request, type Response } from "express";
import puppeteer, {
  type Browser,
  type Page,
  type HTTPRequest,
} from "puppeteer";
import {
  checkIfBookExists,
  getBooks,
  storeBook,
} from "../../modules/get-and-set-books.ts";
import { formatBook } from "../../modules/format-book.ts";

const router: Router = Router();

const TIMEOUT_AMOUNT: number = 2000; // 2 seconds

/**
 * After data has been retrieved from scraper, format the rest of the book data from Google's Book API
 * @param {BookListings} allBooks - All the book data fetched
 * @returns {BookListings} - The finalized formatting of data for the books
 */
const requestBookInfo = async (
  allBooks: BookListings,
): Promise<BookListings> => {
  const timeout = async (delay: number) =>
    await new Promise((res) => setTimeout(res, delay));

  // If we are getting throttled on google's API, increase the delay to avoid needless calls
  let limitDelayExpo: number = 0; // seconds

  // Easier alternative to get the book cover thumbnail to lessen web scraping
  for (const [i, book] of allBooks.entries()) {
    try {
      // Check if book exists first before calling Google APIs for books...
      if (checkIfBookExists(book)) {
        console.log("Duplicate Found:", book.title);
        continue;
      }

      const params: URLSearchParams = new URLSearchParams();
      params.append("q", process.env.SERIES + " " + book.title);
      params.append("key", process.env.GOOGLE_BOOKS_API_KEY as string);
      const url: string = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;

      const response = await fetch(url);

      // Too many requests
      if (response.status === 429) {
        console.log("Enhance your calm...");
        // raise the exponent up by one per "Too Many Request" errors
        const delayBy = Math.pow(2, limitDelayExpo++);
        await timeout(delayBy);
        continue;
      }

      limitDelayExpo = 0; // Reset the exponent

      if (!response.ok)
        throw new Error("Failed to get response from 'googleapis'");

      const result: GoogleBooksResponse = await response.json();

      // No results, skip the rest of the logic
      if (!result?.items?.length) {
        await timeout(TIMEOUT_AMOUNT);
        continue;
      }

      // Format the book into the finalized object to send out
      const formattedBook: BookListing = formatBook(book, result);
      storeBook(formattedBook);

      console.log(
        `Completed book ${i + 1} of ${allBooks.length}: book title: ${formattedBook?.title}`,
      );

      await timeout(TIMEOUT_AMOUNT);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error.message);
        throw new Error("Book retrieval from Google Books API failed:", error);
      } else {
        console.error("Unkown error:", error);
      }
    }
  }

  return allBooks;
};

// TODO: Make a cron job to call this route. Realistic to run 2 or 3 months at a time?
router.post(
  "/",
  async (req: Request, res: Response): Promise<Express.Response> => {
    const allBooks: BookListings = [];

    try {
      console.log("test");
      // You leave me no choice with your hidden APIs...
      const browser: Browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-gpu"],
      });
      const page: Page = await browser.newPage();

      // To save some time, we do not need the CSS and images to load for the scraper.
      await page.setRequestInterception(true);
      page.on("request", (req: HTTPRequest) => {
        if (
          req.resourceType() === "image" ||
          req.resourceType() === "stylesheet"
        ) {
          req.abort();
        } else {
          req.continue();
        }
      });

      const bookPages: Array<string> | undefined =
        process.env.BOOKS_API_ENDPOINT?.split(",");
      if (!bookPages) return res.sendStatus(404);

      for (const endpoint of bookPages) {
        await page.goto(`${endpoint}${process.env.SUB_PATH}`);
        allBooks.push(...(await getBooks(page)));
      }

      await browser.close();
    } catch (error: unknown) {
      if (error instanceof Error)
        return res
          .status(500)
          .send("Unable to retrieve data: " + error.message);
      else
        return res
          .status(500)
          .json({ message: `Unkown error occurred: ${error}` });
    }

    try {
      const formattedAllBooks: BookListings = await requestBookInfo(allBooks);
      return res.status(201).send(JSON.stringify(formattedAllBooks));
    } catch (error: unknown) {
      if (error instanceof Error) return res.status(500).send(error.message);
      else
        return res
          .status(500)
          .json({ message: `Unkown error occurred: ${error}` });
    }
  },
);

export default router;
