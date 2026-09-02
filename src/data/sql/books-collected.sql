CREATE TABLE books_collected (
    id                  INTEGER PRIMARY KEY,
    book_listing_id     INTEGER,
    book_series_id      INTEGER,
    date_purchased      DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed           BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_listing_id) REFERENCES book_listings(id) ON DELETE CASCADE,
    FOREIGN KEY(book_series_id) REFERENCES series_collected(id) ON DELETE CASCADE,
    UNIQUE(book_listing_id, book_series_id)
);

-- Enforces at most one Collected Book per listing (see client ADR 0001);
-- NULL book_listing_id rows are series-owned and exempt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_collected_listing
    ON books_collected(book_listing_id) WHERE book_series_id IS NULL;
