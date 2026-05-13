/**
 * Issue #1279 PR2b — AC-7 / AC-12 prompt 共享 fixture
 *
 * dispatcher-self-baseline.spec.ts 与 dispatcher-semantic-equivalence.spec.ts
 * 都校验同一组用户验收 prompt；为避免业务 owner 改一份漏一份的 silent drift，
 * prompt 内容集中于此模块单点定义。
 *
 * Refs: #1279
 */

export interface AcPromptCase {
  readonly id: string
  readonly utterance: string
}

export const AC7_USER_PROMPTS: readonly AcPromptCase[] = [
  { id: 'ac-7-user-1', utterance: 'BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2%' },
  { id: 'ac-7-user-2', utterance: 'ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空' },
  { id: 'ac-7-user-3', utterance: 'SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断' },
  { id: 'ac-7-user-4', utterance: 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层' },
  { id: 'ac-7-user-5', utterance: 'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT' },
  { id: 'ac-7-user-6', utterance: 'BTC 区间 60000-70000，每格 100 USDT，挂 20 格' },
]

export const AC12_WEBHOOK_PROMPTS: readonly AcPromptCase[] = [
  { id: 'ac-12-webhook-1', utterance: '接 TradingView webhook 信号 BTCUSDT 突破上轨 进场做多' },
  { id: 'ac-12-webhook-2', utterance: '收到 webhook：ETHUSDT side=sell 卖出离场' },
]
