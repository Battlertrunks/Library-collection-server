CREATE TABLE book_listings (
    id              INTEGER PRIMARY KEY,
    title           TEXT NOT NULL,
    summary         TEXT,
    price           REAL NOT NULL,
    thumbnail_url   TEXT,
    listing_url     TEXT NOT NULL
)
