import db from "../data/database.js";

const bookResolver = {
  Query: {
    books: () => {
      console.log("Running");
      return db.prepare("SELECT * FROM books").all();
    },
    book: (_parent: any, args: { id: string }) => {
      console.log(args.id);
      return db.prepare("SELECT * FROM books where id = ?").get(args.id);
    },
  },
  Mutation: {},
};

export default bookResolver;
