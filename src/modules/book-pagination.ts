import { GraphQLError } from "graphql";
import db from "../data/database.ts";

/** Sort modes shared by the paginated book queries. */
export type BookSort =
  | "RECENT"
  | "TITLE_ASC"
  | "TITLE_DESC"
  | "PUBLISHED"
  | "COMPLETION";

/** Default page size when `first` is omitted. */
export const BOOK_PAGE_SIZE: number = 30;

/** Upper bound for `first`, so a single query cannot read the whole table. */
export const MAX_BOOK_PAGE_SIZE: number = 100;

export type PageArgs = {
  first?: number | null;
  after?: string | null;
  search?: string | null;
  sort?: BookSort | null;
};

export type Connection<Row> = {
  edges: Array<{ node: Row; cursor: string }>;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

type BookListingRow = {
  id: number;
  title: string;
  authors: string;
  thumbnail_url: string | null;
  listing_url: string;
  description: string | null;
  published_date: string | null;
  genres: string | null;
  created_at: string;
};

type BookCollectedRow = {
  id: number;
  book_listing_id: number | null;
  date_purchased: string;
  completed: number;
  title: string | null;
  authors: string | null;
  thumbnail_url: string | null;
  published_date: string | null;
  created_at: string | null;
};

/**
 * Shared join so the paginated query and the add_book_collected mutation
 * cannot drift apart.
 */
export const collectedBookSelect: string = `
  SELECT bc.id, bc.book_listing_id, bc.date_purchased, bc.completed,
         bl.title, bl.authors, bl.thumbnail_url, bl.published_date,
         bl.created_at
  FROM books_collected AS bc
  LEFT JOIN book_listings AS bl ON bl.id = bc.book_listing_id
`;

/** Sort applied to a table once COMPLETION falls back to title for listings. */
type EffectiveSort = Exclude<BookSort, "COMPLETION"> | "COMPLETION";

type CursorPayload = {
  v: 1;
  s: EffectiveSort;
  /** Primary sort key of the row (timestamp, lowercased title, ...). */
  k: string;
  /** Lowercased title tie-breaker. */
  t: string;
  /** Row id, the final deterministic tie-breaker. */
  i: number;
  /** Completion flag, only meaningful for COMPLETION sorts. */
  d: number;
};

type SortColumns = {
  createdAt: string;
  publishedAt: string;
  title: string;
  id: string;
  completed: string;
};

const listingColumns: SortColumns = {
  createdAt: "created_at",
  publishedAt: "COALESCE(published_date, '')",
  title: "LOWER(title)",
  id: "id",
  completed: "0",
};

const collectedColumns: SortColumns = {
  createdAt: "COALESCE(bl.created_at, '')",
  publishedAt: "COALESCE(bl.published_date, '')",
  title: "LOWER(COALESCE(bl.title, ''))",
  id: "bc.id",
  completed: "bc.completed",
};

/**
 * Book listings have no completion flag, so COMPLETION falls back to the
 * alphabetical order the client used to apply locally.
 */
function effectiveListingsSort(sort: BookSort): EffectiveSort {
  return sort === "COMPLETION" ? "TITLE_ASC" : sort;
}

function resolvePageSize(first: number | null | undefined): number {
  if (first === null || first === undefined) {
    return BOOK_PAGE_SIZE;
  }
  if (!Number.isInteger(first) || first < 1 || first > MAX_BOOK_PAGE_SIZE) {
    throw new GraphQLError(`Invalid page size: ${first}`, {
      extensions: { code: "INVALID_PAGE_SIZE" },
    });
  }
  return first;
}

function invalidCursor(): GraphQLError {
  return new GraphQLError("Invalid pagination cursor", {
    extensions: { code: "INVALID_CURSOR" },
  });
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function isCursorPayload(value: unknown): value is CursorPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.v === 1 &&
    typeof record.s === "string" &&
    ["RECENT", "TITLE_ASC", "TITLE_DESC", "PUBLISHED", "COMPLETION"].includes(
      record.s,
    ) &&
    typeof record.k === "string" &&
    typeof record.t === "string" &&
    typeof record.i === "number" &&
    typeof record.d === "number"
  );
}

function decodeCursor(cursor: string, expectedSort: EffectiveSort): CursorPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw invalidCursor();
  }
  if (!isCursorPayload(parsed) || parsed.s !== expectedSort) {
    throw invalidCursor();
  }
  return parsed;
}

/** Escapes LIKE metacharacters so a search for "100%" is literal. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Builds an AND-of-keywords filter over the title and authors columns.
 * Every keyword must match at least one column, so "dune herbert" finds
 * Dune by Frank Herbert regardless of keyword order.
 */
function buildSearchClause(
  search: string | null | undefined,
  title: string,
  authors: string,
): { sql: string; params: Record<string, string> } | null {
  const keywords = (search ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (keywords.length === 0) {
    return null;
  }

  const params: Record<string, string> = {};
  const clauses = keywords.map((keyword, index) => {
    const param = `search${index}`;
    params[param] = `%${escapeLike(keyword)}%`;
    return `(LOWER(${title}) LIKE @${param} ESCAPE '\\' OR LOWER(${authors}) LIKE @${param} ESCAPE '\\')`;
  });

  return { sql: clauses.join(" AND "), params };
}

function buildOrderBy(sort: EffectiveSort, columns: SortColumns): string {
  switch (sort) {
    case "RECENT":
      return `${columns.createdAt} DESC, ${columns.title} ASC, ${columns.id} ASC`;
    case "PUBLISHED":
      return `${columns.publishedAt} DESC, ${columns.title} ASC, ${columns.id} ASC`;
    case "TITLE_ASC":
      return `${columns.title} ASC, ${columns.id} ASC`;
    case "TITLE_DESC":
      return `${columns.title} DESC, ${columns.id} DESC`;
    case "COMPLETION":
      return `${columns.completed} DESC, ${columns.title} ASC, ${columns.id} ASC`;
  }
}

/**
 * Keyset predicate selecting only rows after the cursor, matching the
 * ordering produced by buildOrderBy.
 */
function buildKeysetClause(
  sort: EffectiveSort,
  cursor: CursorPayload,
  columns: SortColumns,
): { sql: string; params: Record<string, unknown> } {
  switch (sort) {
    case "RECENT":
      return {
        sql: `(${columns.createdAt} < @cursorK OR (${columns.createdAt} = @cursorK AND (${columns.title} > @cursorT OR (${columns.title} = @cursorT AND ${columns.id} > @cursorI))))`,
        params: {
          cursorK: cursor.k,
          cursorT: cursor.t,
          cursorI: cursor.i,
        },
      };
    case "PUBLISHED":
      return {
        sql: `(${columns.publishedAt} < @cursorK OR (${columns.publishedAt} = @cursorK AND (${columns.title} > @cursorT OR (${columns.title} = @cursorT AND ${columns.id} > @cursorI))))`,
        params: {
          cursorK: cursor.k,
          cursorT: cursor.t,
          cursorI: cursor.i,
        },
      };
    case "TITLE_ASC":
      return {
        sql: `(${columns.title} > @cursorT OR (${columns.title} = @cursorT AND ${columns.id} > @cursorI))`,
        params: { cursorT: cursor.t, cursorI: cursor.i },
      };
    case "TITLE_DESC":
      return {
        sql: `(${columns.title} < @cursorT OR (${columns.title} = @cursorT AND ${columns.id} < @cursorI))`,
        params: { cursorT: cursor.t, cursorI: cursor.i },
      };
    case "COMPLETION":
      return {
        sql: `(${columns.completed} < @cursorD OR (${columns.completed} = @cursorD AND (${columns.title} > @cursorT OR (${columns.title} = @cursorT AND ${columns.id} > @cursorI))))`,
        params: {
          cursorD: cursor.d,
          cursorT: cursor.t,
          cursorI: cursor.i,
        },
      };
  }
}

function listingCursor(sort: EffectiveSort, row: BookListingRow): CursorPayload {
  return {
    v: 1,
    s: sort,
    k:
      sort === "RECENT"
        ? row.created_at
        : sort === "PUBLISHED"
          ? (row.published_date ?? "")
          : row.title.toLowerCase(),
    t: row.title.toLowerCase(),
    i: row.id,
    d: 0,
  };
}

function collectedCursor(
  sort: EffectiveSort,
  row: BookCollectedRow,
): CursorPayload {
  return {
    v: 1,
    s: sort,
    k:
      sort === "RECENT"
        ? (row.created_at ?? "")
        : sort === "PUBLISHED"
          ? (row.published_date ?? "")
          : (row.title ?? "").toLowerCase(),
    t: (row.title ?? "").toLowerCase(),
    i: row.id,
    d: row.completed,
  };
}

/**
 * Turns fetched rows (one extra beyond the page size) into a Relay-style
 * connection. The extra row only signals whether another page exists; its
 * keys are not included in the returned edges.
 */
function toConnection<Row>(
  rows: Row[],
  first: number,
  cursorFor: (row: Row) => CursorPayload,
): Connection<Row> {
  const hasNextPage: boolean = rows.length > first;
  const pageRows: Row[] = rows.slice(0, first);
  const last: Row | undefined = pageRows[pageRows.length - 1];

  return {
    edges: pageRows.map((node) => ({
      node,
      cursor: encodeCursor(cursorFor(node)),
    })),
    pageInfo: {
      hasNextPage,
      endCursor: last ? encodeCursor(cursorFor(last)) : null,
    },
  };
}

/**
 * Fetches one page of not-owned book listings. Listings already collected
 * are excluded so page sizes remain accurate.
 * @param args Page args from the GraphQL query.
 * @returns A connection of listing rows.
 */
export function fetchBookListingsPage(
  args: PageArgs,
): Connection<BookListingRow> {
  const sort: EffectiveSort = effectiveListingsSort(args.sort ?? "RECENT");
  const first: number = resolvePageSize(args.first);
  const cursor: CursorPayload | null = args.after
    ? decodeCursor(args.after, sort)
    : null;

  const where: string[] = [
    "does_own = false",
    "id NOT IN (SELECT book_listing_id FROM books_collected WHERE book_listing_id IS NOT NULL)",
  ];
  const params: Record<string, unknown> = {};

  const search = buildSearchClause(args.search, "title", "authors");
  if (search) {
    where.push(search.sql);
    Object.assign(params, search.params);
  }

  if (cursor) {
    const keyset = buildKeysetClause(sort, cursor, listingColumns);
    where.push(keyset.sql);
    Object.assign(params, keyset.params);
  }

  params.limit = first + 1;
  const rows = db
    .prepare(
      `SELECT * FROM book_listings
        WHERE ${where.join(" AND ")}
        ORDER BY ${buildOrderBy(sort, listingColumns)}
        LIMIT @limit`,
    )
    .all(params) as BookListingRow[];

  return toConnection(rows, first, (row) => listingCursor(sort, row));
}

/**
 * Fetches one page of collected books joined with their listings.
 * Series-owned rows (no book_listing_id) are excluded so every edge has
 * listing fields.
 * @param args Page args from the GraphQL query.
 * @returns A connection of collected-book rows.
 */
export function fetchBooksCollectedPage(
  args: PageArgs,
): Connection<BookCollectedRow> {
  const sort: EffectiveSort = args.sort ?? "RECENT";
  const first: number = resolvePageSize(args.first);
  const cursor: CursorPayload | null = args.after
    ? decodeCursor(args.after, sort)
    : null;

  const where: string[] = ["bc.book_listing_id IS NOT NULL"];
  const params: Record<string, unknown> = {};

  const search = buildSearchClause(
    args.search,
    "COALESCE(bl.title, '')",
    "COALESCE(bl.authors, '')",
  );
  if (search) {
    where.push(search.sql);
    Object.assign(params, search.params);
  }

  if (cursor) {
    const keyset = buildKeysetClause(sort, cursor, collectedColumns);
    where.push(keyset.sql);
    Object.assign(params, keyset.params);
  }

  params.limit = first + 1;
  const rows = db
    .prepare(
      `${collectedBookSelect}
        WHERE ${where.join(" AND ")}
        ORDER BY ${buildOrderBy(sort, collectedColumns)}
        LIMIT @limit`,
    )
    .all(params) as BookCollectedRow[];

  return toConnection(rows, first, (row) => collectedCursor(sort, row));
}
