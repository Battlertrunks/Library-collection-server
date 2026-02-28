export type BookListing = {
  title:            string;
  authors:          string;
  price:            string;
  thumbnail_url:    string;
  listing_url:      string;
  description:      string;
  published_date:   string | null;
  genres:           string;
}

export type BookListings = Array<BookListing>;
