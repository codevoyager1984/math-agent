export interface BaseModel {
  id: number;
  created_at: Date;
  updated_at: Date;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
