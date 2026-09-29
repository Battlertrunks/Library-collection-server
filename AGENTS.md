# AGENTS.md

Guidance for AI coding agents working in this repo (Library-collection-server).
The client repo lives at `../Library-collection-client`.

## Project Overview

GraphQL API for a personal book library (books owned + wishlist listings).
Node + TypeScript (ESM, strict), Apollo Server 5 on Express 5, SQLite
(better-sqlite3, WAL), and a Puppeteer web scraper enriched via the Google
Books API.

## Commands

Package manager is **pnpm** — never use npm/yarn.

| Command | Purpose |
| --- | --- |
| `pnpm start` | Dev server (watch mode), port 3000 |
| `pnpm build` | Type-check only (`tsc`, `noEmit: true`) |
| `pnpm lint` / `pnpm lint:fix` | ESLint (flat config) |
| `pnpm test` | Vitest in watch mode |
| `pnpm test:run` | Vitest single run (CI) |

Verification before finishing any task: `pnpm lint`, `pnpm build`, and
`pnpm test:run` must pass.

## Architecture

```
src/
├── index.ts                  # Entrypoint: Express + Apollo at :3000, /graphql
├── api/web-scrapper/         # POST /retrieve-book-information (scrape route)
├── data/
│   ├── database.ts           # better-sqlite3 singleton (library.db, WAL)
│   └── sql/                  # Raw CREATE TABLE schema reference files
├── modules/                  # Business logic: scrape parsing, persist, format
├── model/                    # Domain types (BookListing, GoogleBooksResponse)
├── resolvers/                # GraphQL resolvers, aggregated in resolvers.ts
├── schemas/                  # GraphQL SDL as template strings, merged in typeDefs.ts
└── types/                    # Shared TS interfaces (Book)
```

Scrape flow: `retrieves-books.ts` router → Puppeteer scrape (`getBooks`) →
dedupe (`checkIfBookExists`) → Google Books enrichment (`formatBook`) →
SQLite insert (`storeBook`).

## Conventions

- Strict TS: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` — treat compiler errors as blockers.
- ESM (`"type": "module"`); use `import type` for type-only imports (`verbatimModuleSyntax`).
- Prefer `.ts` extensions in relative imports (`allowImportingTsExtensions`); some legacy files use `.js` — do not add more of those.
- Explicit return types on exported functions; JSDoc for non-obvious ones.
- SQL: always prepared statements; named params (`@title`) for inserts.
- Errors: `catch (error: unknown)`, narrow via `error instanceof Error`.
- Default exports: resolvers, router, db. Named exports: types, defs, helpers.
- GraphQL fields use snake_case (mirrors DB columns).

## Testing

Vitest, colocated as `*.test.ts` next to the code under test. `pnpm test`
watches; `pnpm test:run` is the single-run/CI variant.

- `vitest.setup.ts` globally replaces `src/data/database.ts` with a fresh
  in-memory database, so no test can touch the real `library.db`. Never
  import the real database module unmocked.
- `src/test/database.ts` builds the schema by executing the real
  `src/data/sql/*.sql` files and resets rows between tests; factories live in
  `src/test/`.
- Resolver tests run queries through Apollo's `executeOperation` — no HTTP
  server is started.
- No test may hit the network (scraper coverage is a future effort).
- CI runs lint, typecheck, and tests as separate workflows
  (`.github/workflows/lint.yml`, `typecheck.yml`, `test.yml`) on PRs.

## Environment & Database

- Env vars (dotenv, `.env` is gitignored — never commit or print values):
  `GOOGLE_BOOKS_API_KEY`, `SITE_PAGE`, `SUB_PATH`, `BOOKS_API_ENDPOINT` (comma-separated), `SERIES`
- DB file `library.db` at project root (gitignored). Do not commit `*.db*`.
- `pnpm-workspace.yaml` whitelists native builds (better-sqlite3, puppeteer, @apollo/protobufjs) — keep intact.

## Git Hooks

- Husky pre-commit runs `pnpm run lint` on the **whole repo** (not just staged files). If any file fails lint, the commit fails — run `pnpm lint` before committing.

## Gotchas

- Legacy `Book` type, `book(id)` query, and Mutation SDL were removed (2026-09); the `books` table they referenced is not part of the SQL schema.
- `books_collected` rows are joined to `book_listings` via LEFT JOIN in the `books_collected` resolver — series-owned rows (`book_listing_id IS NULL`) return null listing fields.
- Keep scraping ethical: preserve timeouts, request interception, and rate-limit backoff; respect robots.txt.
- Port 3000 is hardcoded in `index.ts`.
