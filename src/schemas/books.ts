export const booksDefs = `
  type BookListings {
    id: ID
    title: String
    authors: String
    thumbnail_url: String
    listing_url: String
    description: String
    published_date: String
    genres: String
  }

  type Query {
    book_listings: [BookListings!]!
  }
`;
