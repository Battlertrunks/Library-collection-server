import db from "../data/database.js";

const bookResolver: any = {
  Query: {
    book_listings: (_parent: any) => {
      const query: string =
        "SELECT * FROM book_listings WHERE does_own = false";
      return db.prepare(query).all();
    },
    book: (_parent: any, args: { id: string }) => {
      console.log(args.id);
      return db.prepare("SELECT * FROM books where id = ?").get(args.id);
    },
  },
  Mutation: {},
};

export default bookResolver;
