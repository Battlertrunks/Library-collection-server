import db from "../data/database.js";
import type { BookListing } from "../model/BookListing.js";

interface BookResolver {
  Query: object;
  Mutation: object;
}

function toPrice(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const bookResolver: BookResolver = {
  Query: {
    book_listings: () => {
      const query: string =
        "SELECT * FROM book_listings WHERE does_own = false";
      const rows = db.prepare(query).all() as BookListing[];
      return rows.map((row) => ({ ...row, price: toPrice(row.price) }));
    },
    book: (_: ParentNode, args: { id: string }) => {
      return db.prepare("SELECT * FROM books where id = ?").get(args.id);
    },
  },
  Mutation: {},
};

export default bookResolver;
