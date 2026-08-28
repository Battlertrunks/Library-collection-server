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
| `pnpm test` | Vitest in watch mode (no test files exist yet) |

Verification before finishing any task: `pnpm lint` and `pnpm build` must pass.
If you add tests, co-locate as `*.test.ts` (Vitest is configured, unused).

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

## Environment & Database

- Env vars (dotenv, `.env` is gitignored — never commit or print values):
  `GOOGLE_BOOKS_API_KEY`, `SITE_PAGE`, `SUB_PATH`, `BOOKS_API_ENDPOINT` (comma-separated), `SERIES`
- DB file `library.db` at project root (gitignored). Do not commit `*.db*`.
- `pnpm-workspace.yaml` whitelists native builds (better-sqlite3, puppeteer, @apollo/protobufjs) — keep intact.

## Git Hooks

- Husky pre-commit runs `pnpm run lint` on the **whole repo** (not just staged files). If any file fails lint, the commit fails — run `pnpm lint` before committing.

## Gotchas

- Mutations declared in SDL (`addNewBook`, `updateExistingBook`, `deleteExistingBook`) are NOT implemented (`Mutation: {}` in resolvers).
- Keep scraping ethical: preserve timeouts, request interception, and rate-limit backoff; respect robots.txt.
- Port 3000 is hardcoded in `index.ts`.
