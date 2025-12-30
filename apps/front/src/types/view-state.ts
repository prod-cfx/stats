export interface ViewState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

export interface MockOptions {
  delay?: number;
  shouldError?: boolean;
  isEmpty?: boolean;
}
