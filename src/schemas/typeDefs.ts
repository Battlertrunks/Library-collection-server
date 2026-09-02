import { booksDefs } from "./books.ts";
import { booksCollectedDefs } from "./books-collected.ts";

// Holds all of the defs from the schemas
export const typeDefs = `#graphql
  ${booksDefs}
  ${booksCollectedDefs}
`;
