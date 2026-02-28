export const booksDefs = `
  type BookListing {
    id: ID
    title: String
    authors: String
    price: Int
    thumbname_url: String
    listing_url: String
    description: String
    published_date: String
    genre: String
    completed: Boolean
    created_at: String
    updated_at: String
  }

  BooksCollected {
    id: ID
    book_listing_id: Int
    book_series_id: Int
    date_purchased: String
    completed: Boolean
    created_at: String
    updated_at: String
  }

  Collection {
    id: ID
    name: String
    description: String
    books_collected: Int
    created_at: String
    Updated_at: String
  }

  Reviews {
    id: ID
    books_collected: Int
    review_description: String
    rating: Int
    created_at: String
    updated_at: String
  }

  SeriesCollected {
    id: ID
    name: String
    description: String
    created_at: String
    updated_at: String
  }

  type Query {
    books: [Book!]!
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
