/**
 * 31 条策略 mock planner data（Issue #1496 块 3）
 *
 * 与块 1 `thirty-one-strategies.ts` 一一对应，与块 2 harness runner 共享
 * `PlannerMockResponse` interface 形状。
 *
 * 设计原则：
 *  - 每条策略至少 1 个 mock response，多数情况下单 mock 即可（mock LLM 直接
 *    返回完整 rules tree，不模拟追问轮次）。
 *  - `condition` / `effects` 字段使用 `unknown`，让 block 2 harness 在运行时
 *    按需 narrow，避免与真实 AtomExpr schema 提前耦合（schema 仍在演进）。
 *  - 7 条 expectedRoute = unsupported 策略仍输出 rules：rules 中包含
 *    「尚未实装」的 atom key（如 condition.sequence / risk.atr_multiple_take_profit /
 *    position.dca_schedule / grid.adaptive_quantile / external_signal.webhook_binding），
 *    用于触发 publication stage fail-closed（#1496 阶段 A 期望）。
 *  - atom params 取合理占位（与 fixture.userInput 描述大致一致），不追求像素级精确。
 *
 * 多轮 clarification：当前全部策略起步使用 1 个 mock；块 4 spec 跑通后，如
 * readiness 层确实要求追问，再补 logicReady:false → logicReady:true 的两段式 mock。
 */

// #1496-M4: PlannerMockResponse 抽到 ../../golden/types，与 harness runner 共用
import type { PlannerMockResponse } from '../golden/types'

export type { PlannerMockResponse }

// ---------- 小工具：构造 atom node（避免每条策略重复字面量噪音） ----------

interface AtomNodeLike {
  kind: 'atom'
  key: string
  params: Record<string, unknown>
}

function atom(key: string, params: Record<string, unknown> = {}): AtomNodeLike {
  return { kind: 'atom', key, params }
}

/** #1496-C1: AtomExpr 树规范要求 `kind: 'and' | 'or'`（参考 types/atom-expr.ts walkAtomExpr），
 *  原 `kind: 'logical', op: 'AND'` 形态不被 collectAtomLeaves 识别，所有叶子被静默丢弃，
 *  导致 state.trigger / state.action 永远为空。修正为标准 AtomExpr 形态。 */
interface AndNodeLike {
  kind: 'and'
  children: unknown[]
}

interface OrNodeLike {
  kind: 'or'
  children: unknown[]
}

function and(...children: unknown[]): AndNodeLike {
  return { kind: 'and', children }
}

function or(...children: unknown[]): OrNodeLike {
  return { kind: 'or', children }
}

// ---------- 31 条 mock ----------

export const PLANNER_MOCKS_BY_STRATEGY: Readonly<Record<number, readonly PlannerMockResponse[]>> = {
  // 1. OKX BTCUSDT perp 双向网格 60000-80000
  1: [
    {
      related: true,
      logicReady: true,
      assistantPrompt: '已识别 OKX BTCUSDT 永续 15m 双向网格策略',
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'okx',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r1-grid',
            phase: 'entry',
            sideScope: 'both',
            condition: atom('grid.range_rebalance', {
              upperBound: 80000,
              lowerBound: 60000,
              gridSpacingPct: 0.5,
              positionPct: 10,
            }),
            effects: [atom('open_long'), atom('open_short')],
            evidence: { text: '60000-80000 双向网格，每格 0.5%' },
          },
          {
            id: 'r1-risk',
            phase: 'gate',
            sideScope: 'both',
            condition: and(
              atom('risk.stop_loss_pct', { pct: 5 }),
              atom('risk.take_profit_pct', { pct: 10 }),
            ),
            effects: [],
            evidence: { text: '5% 止损 / 10% 止盈' },
          },
        ],
      },
    },
  ],

  // 2. EMA trend gate + BOLL trigger 双向开仓
  2: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r2-long',
            phase: 'entry',
            sideScope: 'long',
            condition: and(
              atom('indicator.above', { indicator: 'EMA20' }),
              atom('indicator.above', { indicator: 'EMA60' }),
              atom('indicator.above', { indicator: 'EMA144' }),
              atom('bollinger.touch_lower', { period: 20, stdDev: 2 }),
            ),
            effects: [atom('open_long')],
          },
          {
            id: 'r2-short',
            phase: 'entry',
            sideScope: 'short',
            condition: and(
              atom('indicator.below', { indicator: 'EMA20' }),
              atom('indicator.below', { indicator: 'EMA60' }),
              atom('indicator.below', { indicator: 'EMA144' }),
              atom('bollinger.touch_upper', { period: 20, stdDev: 2 }),
            ),
            effects: [atom('open_short')],
          },
          {
            id: 'r2-sl',
            phase: 'gate',
            sideScope: 'both',
            condition: atom('risk.stop_loss_pct', { pct: 5 }),
            effects: [],
          },
        ],
      },
    },
  ],

  // 3. EMA 多均线上方做多 + 跌破 EMA20 平多
  3: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r3-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: and(
              atom('indicator.above', { indicator: 'EMA20' }),
              atom('indicator.above', { indicator: 'EMA60' }),
              atom('indicator.above', { indicator: 'EMA144' }),
            ),
            effects: [atom('open_long')],
          },
          {
            id: 'r3-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('indicator.below', { indicator: 'EMA20' }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 4. BOLL 上/下/中轨双向 + 中轨平仓
  4: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'okx',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r4-long',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('bollinger.touch_lower', { period: 20, stdDev: 2 }),
            effects: [atom('open_long')],
          },
          {
            id: 'r4-short',
            phase: 'entry',
            sideScope: 'short',
            condition: atom('bollinger.touch_upper', { period: 20, stdDev: 2 }),
            effects: [atom('open_short')],
          },
          {
            id: 'r4-exit',
            phase: 'exit',
            sideScope: 'both',
            condition: atom('bollinger.touch_middle', { period: 20, stdDev: 2 }),
            effects: [atom('close_long'), atom('close_short')],
          },
        ],
      },
    },
  ],

  // 5. RSI ≤ 30 开多 + ATR 止损 + 分批止盈 + 回撤护栏
  5: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'ETHUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r5-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('oscillator.rsi_lte', { period: 14, threshold: 30 }),
            effects: [atom('open_long')],
          },
          {
            id: 'r5-pt',
            phase: 'gate',
            sideScope: 'long',
            condition: atom('risk.partial_take_profit', { pct: 3, sizePct: 50 }),
            effects: [],
          },
          {
            id: 'r5-dd',
            phase: 'gate',
            sideScope: 'both',
            condition: atom('portfolioRisk.drawdown_block', { pct: 10 }),
            effects: [],
          },
        ],
      },
    },
  ],

  // 6. EMA + BOLL 双向（与 #2 同源 userInput，独立 mock 便于报告归因）
  6: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r6-long',
            phase: 'entry',
            sideScope: 'long',
            condition: and(
              atom('indicator.above', { indicator: 'EMA20' }),
              atom('bollinger.touch_lower', { period: 20, stdDev: 2 }),
            ),
            effects: [atom('open_long')],
          },
          {
            id: 'r6-short',
            phase: 'entry',
            sideScope: 'short',
            condition: and(
              atom('indicator.below', { indicator: 'EMA20' }),
              atom('bollinger.touch_upper', { period: 20, stdDev: 2 }),
            ),
            effects: [atom('open_short')],
          },
        ],
      },
    },
  ],

  // 7. OKX BTCUSDT perp 15m BOLL 双向 + 中轨平仓（publishable）
  7: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'okx',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r7-long',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('bollinger.touch_lower', { period: 20, stdDev: 2 }),
            effects: [atom('open_long')],
          },
          {
            id: 'r7-short',
            phase: 'entry',
            sideScope: 'short',
            condition: atom('bollinger.touch_upper', { period: 20, stdDev: 2 }),
            effects: [atom('open_short')],
          },
          {
            id: 'r7-close-long',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('bollinger.touch_middle', { period: 20, stdDev: 2 }),
            effects: [atom('close_long')],
          },
          {
            id: 'r7-close-short',
            phase: 'exit',
            sideScope: 'short',
            condition: atom('bollinger.touch_middle', { period: 20, stdDev: 2 }),
            effects: [atom('close_short')],
          },
        ],
      },
    },
  ],

  // 8. 阳线开多 / 阴线平多
  8: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r8-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('condition.expression', { expr: 'close > open' }),
            effects: [atom('open_long')],
          },
          {
            id: 'r8-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('condition.expression', { expr: 'close < open' }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 9. EMA7 上穿 EMA21 / 下穿平多
  9: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r9-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('indicator.cross_over', { fast: 'EMA7', slow: 'EMA21' }),
            effects: [atom('open_long')],
          },
          {
            id: 'r9-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('indicator.cross_under', { fast: 'EMA7', slow: 'EMA21' }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 10. OKX 现货 ETHUSDT 1m centered grid
  10: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'ETHUSDT',
          timeframe: '1m',
          exchange: 'okx',
          marketType: 'spot',
        },
        rules: [
          {
            id: 'r10-grid',
            phase: 'entry',
            sideScope: 'both',
            condition: atom('grid.range_rebalance', {
              centered: true,
              halfRangePct: 0.4,
              levels: 10,
              perLevelQuoteAmount: 10,
              orderType: 'limit',
            }),
            effects: [atom('open_long'), atom('open_short')],
            evidence: { text: '部署时当前价为中心，上下各 0.4%，10 格' },
          },
        ],
      },
    },
  ],

  // 11. OKX 现货 ORDI/USDT 1h 立即市价开多 + 涨跌幅止盈止损
  11: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'ORDIUSDT',
          timeframe: '1h',
          exchange: 'okx',
          marketType: 'spot',
        },
        rules: [
          {
            id: 'r11-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('execution.on_start', {}),
            effects: [atom('open_long', { positionPct: 10 })],
          },
          {
            id: 'r11-exit-tp',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('price.percent_change', { baseline: 'prev_close', pct: 1 }),
            effects: [atom('close_long')],
          },
          {
            id: 'r11-sl',
            phase: 'gate',
            sideScope: 'long',
            condition: atom('risk.stop_loss_pct', { pct: 5 }),
            effects: [],
          },
          {
            id: 'r11-tp',
            phase: 'gate',
            sideScope: 'long',
            condition: atom('risk.take_profit_pct', { pct: 10 }),
            effects: [],
          },
        ],
      },
    },
  ],

  // 12. BOLL 简写：下轨买入 / 上轨卖出
  12: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r12-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('bollinger.touch_lower', { period: 20, stdDev: 2 }),
            effects: [atom('open_long')],
          },
          {
            id: 'r12-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('bollinger.touch_upper', { period: 20, stdDev: 2 }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 13. OKX BTC/USDT 1h MACD 金叉 / 死叉
  13: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          exchange: 'okx',
          marketType: 'spot',
        },
        rules: [
          {
            id: 'r13-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('indicator.cross_over', { fast: 'MACD', slow: 'MACD_SIGNAL' }),
            effects: [atom('open_long')],
          },
          {
            id: 'r13-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('indicator.cross_under', { fast: 'MACD', slow: 'MACD_SIGNAL' }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 14. OKX BTCUSDT perp 15m EMA7/EMA21 cross + cross margin
  14: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'okx',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r14-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('indicator.cross_over', { fast: 'EMA7', slow: 'EMA21' }),
            effects: [atom('open_long', { positionPct: 10, leverage: 1, marginMode: 'cross' })],
          },
          {
            id: 'r14-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('indicator.cross_under', { fast: 'EMA7', slow: 'EMA21' }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 15. OKX BTCUSDT perp 15m 双向网格 79200-80200
  15: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'okx',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r15-grid',
            phase: 'entry',
            sideScope: 'both',
            condition: atom('grid.range_rebalance', {
              upperBound: 80200,
              lowerBound: 79200,
              gridSpacingPct: 0.1,
              positionPct: 10,
            }),
            effects: [atom('open_long'), atom('open_short')],
          },
          {
            id: 'r15-risk',
            phase: 'gate',
            sideScope: 'both',
            condition: and(
              atom('risk.stop_loss_pct', { pct: 5 }),
              atom('risk.take_profit_pct', { pct: 10 }),
            ),
            effects: [],
          },
        ],
      },
    },
  ],

  // 16. BTC 4h rolling extrema breakout
  16: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '4h',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r16-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('price.rolling_extrema_breakout', { lookback: 20, side: 'high' }),
            effects: [atom('open_long')],
          },
          {
            id: 'r16-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('price.rolling_extrema_breakout', { lookback: 10, side: 'low' }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 17. ETH 日线 MA120 + 回踩 MA20 重新站上（unsupported）
  17: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'ETHUSDT',
          timeframe: '1d',
          exchange: 'binance',
          marketType: 'spot',
        },
        rules: [
          {
            id: 'r17-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: and(
              atom('condition.expression', { expr: 'close > MA120' }),
              atom('condition.sequence', {
                steps: [
                  { name: 'pullback', expr: 'close < MA20' },
                  { name: 'reclaim', expr: 'close > MA20' },
                ],
              }),
            ),
            effects: [atom('open_long')],
            evidence: { text: '日线 MA120 上方 + 回踩 MA20 重新站上' },
          },
        ],
      },
    },
  ],

  // 18. BTC 连跌三根 15m + 下一根放量反弹（unsupported）
  18: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r18-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: and(
              atom('condition.sequence', {
                steps: [
                  { name: 'down1', expr: 'close < open' },
                  { name: 'down2', expr: 'close < open' },
                  { name: 'down3', expr: 'close < open' },
                ],
              }),
              atom('volume.relative_average', { lookback: 20, multiplier: 1.5 }),
            ),
            effects: [atom('open_long')],
          },
        ],
      },
    },
  ],

  // 19. BTC 1h MA50>MA200 + RSI 跌破 35 后重新上穿 35
  19: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r19-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: and(
              atom('condition.expression', { expr: 'MA50 > MA200' }),
              atom('condition.sequence', {
                steps: [
                  { name: 'below35', expr: 'RSI14 < 35' },
                  { name: 'above35', expr: 'RSI14 > 35' },
                ],
              }),
            ),
            effects: [atom('open_long')],
          },
          {
            id: 'r19-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('oscillator.rsi_gte', { period: 14, threshold: 65 }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 20. ETH 15m BOLL 下轨 AND 量价放大买入 / 上轨卖出
  20: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'ETHUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r20-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: and(
              atom('price.detect.indicator_boundary', { indicator: 'BOLL_LOWER', side: 'touch' }),
              atom('volume.relative_average', { lookback: 20, multiplier: 1.5 }),
            ),
            effects: [atom('open_long')],
          },
          {
            id: 'r20-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('price.detect.indicator_boundary', { indicator: 'BOLL_UPPER', side: 'touch' }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 21. SOL 30m MA100 + MACD 金叉 / 跌破 MA100 OR MACD 死叉
  21: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'SOLUSDT',
          timeframe: '30m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r21-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: and(
              atom('indicator.above', { indicator: 'MA100' }),
              atom('indicator.cross_over', { fast: 'MACD', slow: 'MACD_SIGNAL' }),
            ),
            effects: [atom('open_long')],
          },
          {
            id: 'r21-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: or(
              atom('indicator.below', { indicator: 'MA100' }),
              atom('indicator.cross_under', { fast: 'MACD', slow: 'MACD_SIGNAL' }),
            ),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 22. BTC 突破 24h 高点 + 回踩 + remembered level stop（unsupported）
  22: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r22-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('condition.sequence', {
              steps: [
                { name: 'breakout', expr: 'close > high_24h' },
                { name: 'retest', expr: 'low >= breakout_price' },
              ],
            }),
            effects: [atom('open_long')],
          },
          {
            id: 'r22-stop',
            phase: 'gate',
            sideScope: 'long',
            condition: atom('risk.remembered_level_stop', { source: 'breakout_price' }),
            effects: [],
          },
        ],
      },
    },
  ],

  // 23. ETH 1h 突破 MA20 + 2x ATR 止损 / 3x ATR 止盈（unsupported）
  23: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'ETHUSDT',
          timeframe: '1h',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r23-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('indicator.cross_over', { fast: 'close', slow: 'MA20' }),
            effects: [atom('open_long')],
          },
          {
            id: 'r23-sl',
            phase: 'gate',
            sideScope: 'long',
            condition: atom('risk.atr_multiple_stop', { multiplier: 2 }),
            effects: [],
          },
          {
            id: 'r23-tp',
            phase: 'gate',
            sideScope: 'long',
            condition: atom('risk.atr_multiple_take_profit', { multiplier: 3 }),
            effects: [],
          },
        ],
      },
    },
  ],

  // 24. binance BTCUSDT perp 多周期 EMA20 上方买入 / 15m 跌破卖出
  24: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r24-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: and(
              atom('indicator.above', { indicator: 'EMA20', timeframe: '15m' }),
              atom('indicator.above', { indicator: 'EMA20', timeframe: '1h' }),
              atom('indicator.above', { indicator: 'EMA20', timeframe: '4h' }),
            ),
            effects: [atom('open_long')],
          },
          {
            id: 'r24-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('indicator.below', { indicator: 'EMA20', timeframe: '15m' }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 25. Webhook 外部信号 binding（unsupported）
  25: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r25-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('external.signal', { signalId: 'entry-long', secret: 'SECRET_PLACEHOLDER' }),
            effects: [atom('open_long', { positionPct: 10 })],
          },
          {
            id: 'r25-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('external.signal', { signalId: 'exit-long', secret: 'SECRET_PLACEHOLDER' }),
            effects: [atom('close_long')],
          },
        ],
      },
    },
  ],

  // 26. RSI 跌破阈值入场 / 回到阈值出场
  26: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r26-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('oscillator.rsi_lte', { period: 14, threshold: 30 }),
            effects: [atom('open_long', { positionPct: 10 })],
          },
          {
            id: 'r26-exit',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('oscillator.rsi_gte', { period: 14, threshold: 50 }),
            effects: [atom('close_long')],
          },
          {
            id: 'r26-sl',
            phase: 'gate',
            sideScope: 'long',
            condition: atom('risk.stop_loss_pct', { pct: 5 }),
            effects: [],
          },
        ],
      },
    },
  ],

  // 27. OKX BTCUSDT perp 1m BOLL(5,1) 双向 + 中轨平仓 + 紧 SL/TP
  27: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          exchange: 'okx',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r27-long',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('bollinger.touch_lower', { period: 5, stdDev: 1 }),
            effects: [atom('open_long', { positionPct: 10 })],
          },
          {
            id: 'r27-short',
            phase: 'entry',
            sideScope: 'short',
            condition: atom('bollinger.touch_upper', { period: 5, stdDev: 1 }),
            effects: [atom('open_short', { positionPct: 10 })],
          },
          {
            id: 'r27-close-long',
            phase: 'exit',
            sideScope: 'long',
            condition: atom('bollinger.touch_middle', { period: 5, stdDev: 1 }),
            effects: [atom('close_long')],
          },
          {
            id: 'r27-close-short',
            phase: 'exit',
            sideScope: 'short',
            condition: atom('bollinger.touch_middle', { period: 5, stdDev: 1 }),
            effects: [atom('close_short')],
          },
          {
            id: 'r27-risk',
            phase: 'gate',
            sideScope: 'both',
            condition: and(
              atom('risk.stop_loss_pct', { pct: 1 }),
              atom('risk.take_profit_pct', { pct: 1.5 }),
            ),
            effects: [],
          },
        ],
      },
    },
  ],

  // 28. 账户回撤 10% 暂停开新仓
  28: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'ETHUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r28-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('oscillator.rsi_lte', { period: 14, threshold: 30 }),
            effects: [atom('open_long')],
          },
          {
            id: 'r28-dd',
            phase: 'gate',
            sideScope: 'both',
            condition: atom('portfolioRisk.drawdown_block', { pct: 10 }),
            effects: [],
            evidence: { text: '账户回撤 ≥ 10% 暂停开新仓' },
          },
        ],
      },
    },
  ],

  // 29. BTC 回踩 MA20 不破后加仓 + pyramiding limit
  29: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r29-entry',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('condition.sequence', {
              steps: [
                { name: 'pullback', expr: 'low <= MA20' },
                { name: 'hold', expr: 'close > MA20' },
              ],
            }),
            effects: [atom('action.add_position', { sizePct: 20 })],
          },
          {
            id: 'r29-pyramid',
            phase: 'gate',
            sideScope: 'long',
            condition: atom('position.pyramiding_limit', { maxLayers: 3 }),
            effects: [],
          },
        ],
      },
    },
  ],

  // 30. DCA 定投 + 回撤加投 overlay（unsupported）
  30: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '1d',
          exchange: 'binance',
          marketType: 'spot',
        },
        rules: [
          {
            id: 'r30-dca',
            phase: 'entry',
            sideScope: 'long',
            condition: atom('position.dca_schedule', {
              interval: 'weekly',
              dayOfWeek: 'monday',
              amountQuote: 100,
              maxTotalQuote: 2000,
            }),
            effects: [atom('open_long')],
          },
          {
            id: 'r30-overlay',
            phase: 'gate',
            sideScope: 'long',
            condition: atom('portfolioRisk.drawdown_block', { pct: 10, addInvestQuote: 200 }),
            effects: [],
          },
        ],
      },
    },
  ],

  // 31. 自适应网格 range quantile gate + activeWhen + 停网平仓（unsupported）
  31: [
    {
      related: true,
      logicReady: true,
      semanticPatch: {
        contextSlots: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          exchange: 'binance',
          marketType: 'perp',
        },
        rules: [
          {
            id: 'r31-grid',
            phase: 'entry',
            sideScope: 'both',
            condition: atom('grid.range_rebalance', {
              activeWhen: {
                quantileGate: { lookbackHours: 4, lower: 0.2, upper: 0.8 },
              },
              gridSpacingPct: 1,
            }),
            effects: [atom('open_long'), atom('open_short')],
          },
          {
            id: 'r31-exit',
            phase: 'exit',
            sideScope: 'both',
            condition: atom('condition.expression', { expr: '!quantile_in_range' }),
            effects: [atom('close_long'), atom('close_short')],
          },
        ],
      },
    },
  ],
} as const

// 健全性校验：与 fixture 一致的 31 条策略覆盖
{
  const ids = Object.keys(PLANNER_MOCKS_BY_STRATEGY).map(Number).sort((a, b) => a - b)
  if (ids.length !== 31) {
    throw new Error(`[thirty-one-strategies-planner-mocks] expected 31 entries, got ${ids.length}`)
  }
  for (let i = 1; i <= 31; i += 1) {
    if (!ids.includes(i)) {
      throw new Error(`[thirty-one-strategies-planner-mocks] missing strategy id ${i}`)
    }
    const mocks = PLANNER_MOCKS_BY_STRATEGY[i]
    if (!mocks || mocks.length === 0) {
      throw new Error(`[thirty-one-strategies-planner-mocks] strategy ${i} has no mock response`)
    }
  }
}
