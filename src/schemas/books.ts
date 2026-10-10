export const booksDefs = `
  enum BookSort {
    RECENT
    TITLE_ASC
    TITLE_DESC
    PUBLISHED
    COMPLETION
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type BookListings {
    id: ID
    title: String
    authors: String
    thumbnail_url: String
    listing_url: String
    description: String
    published_date: String
    genres: String
    created_at: String
  }

  type BookListingsEdge {
    node: BookListings!
    cursor: String!
  }

  type BookListingsConnection {
    edges: [BookListingsEdge!]!
    pageInfo: PageInfo!
  }

  type Query {
    book_listings(
      first: Int = 30
      after: String
      search: String
      sort: BookSort = RECENT
    ): BookListingsConnection!
  }
`;
