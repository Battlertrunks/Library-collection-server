CREATE TABLE book_listings (
    id              INTEGER PRIMARY KEY,
    title           TEXT NOT NULL,
    isbn            TEXT UNIQUE, -- certain books may not have an ISBN
    author          TEXT NOT NULL,
    price           REAL NOT NULL,
    thumbnail_url   TEXT,
    listing_url     TEXT NOT NULL,
    description     TEXT,
    published_date  DATE,
    genre           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
