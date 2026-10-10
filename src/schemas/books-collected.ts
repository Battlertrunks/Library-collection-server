export const booksCollectedDefs = `
  type BooksCollected {
    id: ID
    book_listing_id: ID
    date_purchased: String
    completed: Boolean
    progress: Int
    title: String
    authors: String
    thumbnail_url: String
    published_date: String
    created_at: String
  }

  type BooksCollectedEdge {
    node: BooksCollected!
    cursor: String!
  }

  type BooksCollectedConnection {
    edges: [BooksCollectedEdge!]!
    pageInfo: PageInfo!
  }

  extend type Query {
    books_collected(
      first: Int = 30
      after: String
      search: String
      sort: BookSort = RECENT
      completed: Boolean
    ): BooksCollectedConnection!
    book_of_the_day: BooksCollected
  }

  type Mutation {
    add_book_collected(book_listing_id: ID!): BooksCollected!
    remove_book_collected(book_listing_id: ID!): BooksCollected!
    update_book_progress(book_listing_id: ID!, progress: Int!): BooksCollected!
  }
`;
