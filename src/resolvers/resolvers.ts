import bookResolver from "./books.js";

// Holds all of the resolvers for the GraphQL server
const resolvers = {
  Query: {
    ...bookResolver.Query,
  },
};

export default resolvers;
