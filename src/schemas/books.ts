export const booksDefs = `
  type BookListings {
    id: ID
    title: String
    authors: String
    price: Int
    thumbnail_url: String
    listing_url: String
    description: String
    published_date: String
    genres: String
  }

  type Book {
    id: ID
    title: String
    date_purchased: String
    completed: Boolean
    release_year: Int
    author: String
    genre: String
  }

  type Query {
    book_listings: [BookListings!]!
    book(id: ID!): Book
  }

  input AddNewBook {
    title: String!
  }

  input UpdateExistingBook {
    title: String!
    completed: Boolean!
  }

  type Mutation {
    addNewBook(input: AddNewBook): Book!
    updateExistingBook(input: UpdateExistingBook): Book
    deleteExistingBook(id: ID!): Boolean!
  }
`;
