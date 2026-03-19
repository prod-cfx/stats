export interface JobRunResult {
  fetchedCount: number
  /**
   * 新的游标（例如 ISO 时间戳 / 自增 ID / 复合 JSON 字符串等）
   * 由具体 Job 决定格式，统一以 string/null 形式保存
   */
  newCursor?: string | null
  /**
   * 可选的扩展信息，用于持久化到执行历史的 meta 字段，方便排查
   *
   * 注意：这里的 meta 是「执行结果」相关信息，
   * 与 DataPullTask.meta（任务级配置参数）含义不同。
   */
  meta?: Record<string, any>
}

/**
 * DataPullJob 运行上下文：
 * - 由调度器在每次执行前构造
 * - 为 Job 提供当前任务的标识、游标以及任务级配置参数（meta）
 */
export interface DataPullJobContext<TMeta = any> {
  /**
   * 当前 DataPullTask 的主键 ID
   */
  readonly taskId: number
  /**
   * 任务 key，应与 DataPullJob.key / data_pull_tasks.key 一致
   */
  readonly key: string
  /**
   * 当前保存的游标（可能为 null）
   */
  readonly cursor: string | null
  /**
   * 任务级自定义配置参数（来自 data_pull_tasks.meta），
   * 由具体 Job 自行约定结构并解析。
   *
   * - Job 内部应对 meta 做健壮性校验 / 兜底
   * - 建议仅在需要时读取，避免与执行结果 meta 混淆
   */
  readonly meta: TMeta | null
  /**
   * 本次调度的时间戳（由调度器统一提供，便于对齐日志和执行窗口）
   */
  readonly now: Date
}

/**
 * Meta 字段的格式说明（用于前端展示）
 */
export interface JobMetaFieldSchema {
  /** 字段名 */
  name: string
  /** 字段类型 */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  /** 是否必填 */
  required: boolean
  /** 字段说明 */
  description: string
  /** 可选值列表（如果有） */
  options?: string[]
  /** 默认值 */
  defaultValue?: any
}

/**
 * Job 的 Meta 配置说明
 */
export interface JobMetaSchema {
  /** 简要说明 */
  description: string
  /** 字段列表 */
  fields: JobMetaFieldSchema[]
  /** 示例 JSON */
  example: Record<string, any>
}

/**
 * 所有定时数据拉取任务的统一接口
 *
 * - 一个任务对应一类数据（例如：kline-1m / news-latest）
 * - 任务通过 key 与数据库中的任务配置关联
 */
export interface DataPullJob<TMeta = any> {
  /**
   * 任务唯一标识，应与 data_pull_task 表中的 key 一致
   */
  readonly key: string

  /**
   * 任务名称（用于前端展示）
   */
  readonly name?: string

  /**
   * Meta 配置格式说明（用于前端展示，帮助用户填写正确的配置）
   */
  readonly metaSchema?: JobMetaSchema

  /**
   * 执行一次完整的数据拉取流程
   *
   * @param ctx 当前任务执行上下文（包含 cursor / meta 等）
   */
  run: (ctx: DataPullJobContext<TMeta>) => Promise<JobRunResult>
}

