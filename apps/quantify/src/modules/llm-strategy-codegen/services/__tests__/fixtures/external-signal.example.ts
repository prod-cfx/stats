/**
 * external.signal atom 示例 fixture（atom-only `supported_requires_slot`）
 *
 * 三个必填 slot：
 *   provider: 'tradingview' | 'discord' | 'telegram' | 'webhook'
 *   signalId: 外部订阅 ID（用户提供）
 *   secret:   HMAC 校验密钥（用户提供 / 系统补全）
 *
 * 不直接进入 canonical/runtime 路径——webhook ingestion / HMAC 验证 /
 * signal queue 基建另开 follow-up issue 跟踪。
 *
 * executableSinceVersion: undefined（atom-only，无运行时）
 */

export const EXTERNAL_SIGNAL_EXAMPLES = {
  /** TradingView webhook 信号（最常见入站方式） */
  tradingviewExample: {
    provider: 'tradingview' as const,
    signalId: 'BTC_PERP_LONG_01',
    secret: 'tradingview-hmac-secret-placeholder',
  },
  /** Discord bot 推送 */
  discordExample: {
    provider: 'discord' as const,
    signalId: 'discord-channel-987654',
    secret: 'discord-hmac-secret-placeholder',
  },
  /** Telegram bot 推送 */
  telegramExample: {
    provider: 'telegram' as const,
    signalId: 'tg-bot-room-123',
    secret: 'tg-hmac-secret-placeholder',
  },
  /** 通用 webhook（用户自建网关） */
  webhookExample: {
    provider: 'webhook' as const,
    signalId: 'custom-webhook-001',
    secret: 'webhook-hmac-secret-placeholder',
  },
} as const
