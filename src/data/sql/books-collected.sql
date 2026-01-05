CREATE TABLE books_collected (
    id                  INTEGER PRIMARY KEY,
    book_listing_id     INTEGER,
    date_purchased      DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed           BOOLEAN DEFAULT FALSE,
    FOREIGN KEY(book_listing_id) REFERENCES book_listings(id) ON DELETE CASCADE
);