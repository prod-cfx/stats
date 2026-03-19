export interface ViewState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

export interface MockOptions {
  delay?: number;
  shouldError?: boolean;
  isEmpty?: boolean;
  /**
   * 是否忽略 URL 上的 mock_error/mock_empty 覆盖，仅使用 options 自身配置
   */
  ignoreQueryOverrides?: boolean;
}
