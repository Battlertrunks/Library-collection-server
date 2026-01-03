CREATE TABLE books (
    id INTEGER PRIMARY KEY,
    book_listing_id INTEGER,
    title TEXT NOT NULL,
    date_purchased DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed BOOLEAN DEFAULT FALSE,
    release_year INTEGER,
    author TEXT,
    genre TEXT,
    FOREIGN KEY(book_listing_id) REFERENCES book_listings(id) ON DELETE CASCADE
);