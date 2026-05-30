export type BookListing = {
  title: string;
  authors: string;
  price: string;
  thumbnail_url: string | null;
  listing_url: string;
  description: string | null;
  published_date: string | null;
  genres: string | null;
};

export type BookListings = Array<BookListing>;

export interface GoogleBooksVolumeInfo {
  publishedDate?: string;
  authors?: string[];
  imageLinks?: { thumbnail?: string };
  description?: string;
  categories?: string[];
}

export interface GoogleBooksItem {
  volumeInfo: GoogleBooksVolumeInfo;
}

export type GoogleBooksResponse = {
  items?: GoogleBooksItem[];
};
