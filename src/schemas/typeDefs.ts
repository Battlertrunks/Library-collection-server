import { booksDefs } from "./books.ts";

// Holds all of the defs from the schemas
export const typeDefs = `#graphql
  ${booksDefs}
`;
