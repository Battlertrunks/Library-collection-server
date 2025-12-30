export interface Book {
  id: number;
  title: string;
  date_purchased: string;
  completed: boolean;
  release_year: number;
  author: string;
  genre: string;
}

export interface AddNewBook {
  title: string;
}

export interface UpdateExistingBook {
  id: number;
  title: string;
  completed: boolean;
}