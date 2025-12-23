export interface JobRunResult {
  fetchedCount: number
  /**
   * 新的游标（例如 ISO 时间戳 / 自增 ID / 复合 JSON 字符串等）
   * 由具体 Job 决定格式，统一以 string/null 形式保存
   */
  newCursor?: string | null
  /**
   * 可选的扩展信息，用于持久化到执行历史的 meta 字段，方便排查
   */
  meta?: Record<string, any>
}

/**
 * 所有定时数据拉取任务的统一接口
 *
 * - 一个任务对应一类数据（例如：kline-1m / news-latest）
 * - 任务通过 key 与数据库中的任务配置关联
 */
export interface DataPullJob {
  /**
   * 任务唯一标识，应与 data_pull_task 表中的 key 一致
   */
  readonly key: string

  /**
   * 执行一次完整的数据拉取流程
   *
   * @param currentCursor 当前保存的游标（可能为 null）
   */
  run: (currentCursor: string | null) => Promise<JobRunResult>
}

