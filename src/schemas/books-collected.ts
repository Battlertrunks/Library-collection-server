export const booksCollectedDefs = `
  type BooksCollected {
    id: ID
    book_listing_id: ID
    date_purchased: String
    completed: Boolean
    title: String
    authors: String
    thumbnail_url: String
    published_date: String
  }

  extend type Query {
    books_collected: [BooksCollected!]!
  }
`;
