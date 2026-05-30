import db from "../data/database.js";

interface BookResolver {
  Query: object;
  Mutation: object;
}

const bookResolver: BookResolver = {
  Query: {
    book_listings: () => {
      const query: string =
        "SELECT * FROM book_listings WHERE does_own = false";
      return db.prepare(query).all();
    },
    book: (_: ParentNode, args: { id: string }) => {
      return db.prepare("SELECT * FROM books where id = ?").get(args.id);
    },
  },
  Mutation: {},
};

export default bookResolver;
