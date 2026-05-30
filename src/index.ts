import { expressMiddleware } from "@as-integrations/express5";
import { ApolloServer } from "@apollo/server";
import resolvers from "./resolvers/resolvers.ts";
import { typeDefs } from "./schemas/typeDefs.ts";
import retrieveBooksRouter from "./api/web-scrapper/retrieves-books.ts";

import Express from "express";
import cors from "cors";

async function init(): Promise<void> {
  const app = Express();
  const port: number = 3000;

  // --- Build the Apollo server instance here ---
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
  });
  // --- Build the Apollo server instance here ---

  await apolloServer.start();

  app.use(cors<cors.CorsRequest>());
  app.use(Express.json());
  app.use("/graphql", expressMiddleware(apolloServer));

  app.use("/retrieve-book-information", retrieveBooksRouter);

  app.listen(port, () => {
    console.log(`App server is listening on port: ${port}`);
  });
}

init().catch((err) => {
  console.log("Failed to start server:", err);
  process.exit(1);
});
