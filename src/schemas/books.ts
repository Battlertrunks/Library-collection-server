export const booksDefs = `
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
