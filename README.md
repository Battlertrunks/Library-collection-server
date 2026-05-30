# library-collection-server

This is the server component of a Library Collection project, which provides a GraphQL API for accessing a collection of books I own and would like to have in the future.

## Features

- GraphQL API for querying book data
- Integration with a SQLite3 database to store book information in collection
- CORS enabled for cross-origin requests
- Ethical web scraping capabilities to fetch book data from external sources
  - Uses environment variables for configuration
  - Sets timeouts and user-agent headers to mimic human browsing behavior and avoid overloading target servers
  - Respects robots.txt rules of target websites and don't abuse scraping frequency. It's on you to ensure your scraping activities comply with the target website's terms of service.
- Code quality tools: **ESLint** for linting and **Husky** for git hooks


## Installation

1. Install the dependencies using pnpm:
   ```bash
   pnpm install
   ```
2. Run the server (Should also build TypeScript and start the server):
   ```bash
   pnpm start
   ```

## Development

This project uses **ESLint** for linting and **Husky** to run `lint-staged` before commits, ensuring code quality and consistency. You can manually run the linter using `pnpm lint`.


## Usage

Once the server is running, you can access the GraphQL API at `http://localhost:3000/graphql`. You can use tools like GraphiQL or Postman to interact with the API.

## Purpose

This server is part of a personal project to create a collection of story, tech, history books, allowing users to query and manage their collection through a GraphQL interface.
I wanted to have an introduction to GraphQL while working on something I enjoy to do on a pass time.

MIT License

Please feel free to fork and modify this project for your own use!
