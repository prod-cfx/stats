/**
 * 构建事件去重键（eventKey），用于生产端 jobId 与消费端分布式去重键的一致约定
 *
 * 键组成：userId + timestamp + sourceId
 * - 生产端：jobId = `<topic>:<eventKey>`
 * - 消费端：`bus:dedupe:<topic>:<eventKey>`
 *
 * 去重策略说明：
 * 1. **包含 timestamp 的设计意图**：
 *    - 同一个 sourceId 在不同时间点的发布会被认为是不同的事件
 *    - 适用场景：前端重试、幂等性窗口有限的场景
 *    - 例如：用户发送同一条消息（sourceId 相同），但在不同时间重试，应该计为不同的尝试
 *
 * 2. **幂等性边界**：
 *    - Message Bus 层面的去重窗口由 Redis TTL 控制（通常为小时级别）
 *    - 业务层面的去重（例如"每日首次访问"）需要在上层实现（例如使用独立的 Redis key）
 *    - 参考：DailyEngagementInterceptor 使用独立的 Redis key 实现每日去重
 *
 * 3. **eventType 说明**：
 *    - eventType 不在 dedupeKey 中，而是在 topic 层面隔离
 *    - 不同 topic 的事件天然隔离，不会冲突
 *
 * @param userId - 用户 ID
 * @param timestamp - 事件时间戳（ISO 8601 格式）
 * @param sourceId - 事件源 ID（可选，例如 messageId、daily-visit-userId-date）
 * @returns 去重键字符串
 */
export function buildEventDedupeKey(userId: string, timestamp: string, sourceId?: string): string {
  return `${userId}-${timestamp}-${sourceId || 'no-source'}`
}
