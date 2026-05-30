CREATE TABLE book_listings (
    id              INTEGER PRIMARY KEY,
    title           TEXT NOT NULL,
    authors         TEXT NOT NULL,
    price           REAL NOT NULL,
    thumbnail_url   TEXT,
    listing_url     TEXT NOT NULL,
    description     TEXT,
    published_date  DATE,
    genres          TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    does_own        BOOLEAN DEFAULT FALSE
);
