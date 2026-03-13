// 消息总线类型定义（极简，可扩展）
// 说明：
// - 通过单一队列 `message-bus` 投递，使用 Job 名称区分 topic
// - 订阅者使用 `@Processor('message-bus')` + `@Process('<topic>')` 进行消费

export interface MessageMeta {
  // 关联追踪 ID，可用于链路追踪
  correlationId?: string
  // ISO 时间戳
  timestamp?: string
  // 版本号（为未来扩展预留）
  version?: number
}

export interface MessageEnvelope<T = unknown> {
  // 事件类型，如 user.created / payment.succeeded
  type: string
  // 业务负载
  data: T
  // 主题（等价于订阅者监听的 job 名称）
  topic: string
  // 额外元信息
  meta?: MessageMeta
}

export interface PublishOptions {
  // 延时（毫秒）
  delayMs?: number
  // 优先级（Bull：1- MAX_INT，数值越小优先级越高）
  priority?: number
  // 尝试次数（默认 3）
  attempts?: number
  // 去重键（将作为 Bull jobId 使用）
  dedupeKey?: string
  // 外部透传的 correlationId（若不提供，publishAndWait 会自动生成）
  correlationId?: string
  // 发布模式（默认使用配置项 messageBus.defaultMode）
  mode?: 'volatile' | 'reliable' | 'handshake'
}

// 轻量握手：完成标记键前缀
export const MESSAGE_HANDSHAKE_DONE_PREFIX = 'bus:done:'

// 队列名常量，避免魔法字符串散落各处
export const MESSAGE_BUS_QUEUE = 'message-bus'

// 调试用：测试标记键前缀（用于 E2E 与 Debug Controller）
export const MESSAGE_TEST_PREFIX = 'test:message-bus:'

// 分布式去重键前缀（SET NX + TTL）
export const MESSAGE_DEDUPE_PREFIX = 'bus:dedupe:'
