CREATE TABLE reviews (
    id                  INTEGER PRIMARY KEY,
    books_collected     INTEGER,
    review_description  TEXT NOT NULL,
    rating              INTEGER CHECK(rating >= 1 AND rating <= 5),
    review_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(books_collected) REFERENCES books_collected(id) ON DELETE CASCADE
)