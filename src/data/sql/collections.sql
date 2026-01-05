-- Store series and collection of related books together. User can create collections
-- to group books they own.
CREATE TABLE collections (
    id                  INTEGER PRIMARY KEY,
    name                TEXT NOT NULL,
    description         TEXT,
    books_collected     INTEGER,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(books_collected) REFERENCES books_collected(id) ON DELETE CASCADE
);