/**
 * AC-8 扩展 prompt e2e 矩阵 — 完整 70 条收口（Wave 1B 收尾）
 *
 * 验收口径（每个 prompt）：
 *  1. session 推进到 DRAFTING 或 CONFIRM_GATE 状态（与 full-matrix.e2e-spec.ts 同口径）
 *  2. 用户可见文本（clarificationGate.summary / assistantPrompt）非空且
 *     通过 InternalKeyLeakGuardService.scan() 0 命中（AC-9 红线）
 *
 * Prompt 设计原则（每个 atom 至少 2 条变体）：
 *  - 同义词换法（如「突破前高」vs「上穿历史高点」）
 *  - 参数换序（先阈值后 atom vs 反之）
 *  - phase 换边（entry vs exit / long vs short）
 *
 * Mock 策略：aiService.chat 被 jest.spyOn 覆盖，返回预构造 semanticPatch JSON，
 * 与 full-matrix.e2e-spec.ts 完全一致的 setup。
 *
 * Atom 覆盖：47 个 atom（含 13 个 orchestration），每个 atom ≥ 2 条变体。
 *
 * Refs: #1279 AC-8 / #1329
 */

import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Test } from '@nestjs/testing'
import { ClsConfigModule } from '@/common/modules/cls.module'
import { EnvModule } from '@/common/modules/env.module'
import { EnvService } from '@/common/services/env.service'
import { AiService } from '@/modules/ai/ai.service'
import { LlmStrategyCodegenModule } from '@/modules/llm-strategy-codegen/llm-strategy-codegen.module'
import { InternalKeyLeakGuardService } from '@/modules/llm-strategy-codegen/nl-gateway/internal-key-leak-guard/internal-key-leak-guard'
import { CallerIdentityService } from '@/modules/llm-strategy-codegen/services/caller-identity.service'
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { MarketSymbolCatalogService } from '@/modules/market-data/services/market-symbol-catalog.service'
import { PrismaService } from '@/prisma/prisma.service'
import { buildApiUrl } from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'

function withBearer(userId: string): Record<string, string> {
  return { authorization: `Bearer ${userId}` }
}

// ---------------------------------------------------------------------------
// 通用 patch 构造 helper
// ---------------------------------------------------------------------------

interface PatchOpts {
  triggers: Array<Record<string, unknown>>
  actions?: Array<Record<string, unknown>>
  risk?: Array<Record<string, unknown>>
  position?: Record<string, unknown>
  orchestration?: Record<string, unknown>
  contextSlots?: Record<string, unknown>
  families?: string[]
}

function buildPatch(opts: PatchOpts): string {
  return JSON.stringify({
    related: true,
    logicReady: true,
    assistantPrompt: '逻辑已完整，请确认后生成代码。',
    semanticPatch: {
      families: opts.families ?? ['single-leg'],
      triggers: opts.triggers,
      actions: opts.actions ?? [{ key: 'open_long' }, { key: 'close_long' }],
      ...(opts.risk ? { risk: opts.risk } : {}),
      position: opts.position ?? { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
      ...(opts.orchestration ? { orchestration: opts.orchestration } : {}),
      contextSlots: opts.contextSlots ?? {
        exchange: 'okx',
        marketType: 'perp',
        symbol: 'BTCUSDT',
        timeframe: '1h',
      },
    },
  })
}

// ---------------------------------------------------------------------------
// 30 条 prompt 矩阵
//
// 编码约定：每条 prompt 至少覆盖一个 atom family 的一种变体。
// label 中的 atom-key 后缀仅用于测试 fail 时定位，不进入用户面文本。
// ---------------------------------------------------------------------------

interface PromptCase {
  label: string
  initialMessage: string
  patch: string
  /** atom family（用于覆盖统计） */
  family: string
}

const PROMPTS: PromptCase[] = [
  // -- oscillator.rsi_lte / rsi_gte（4 条：entry/exit + 同义词 + 参数换序） --
  {
    label: 'rsi_lte-a',
    family: 'oscillator.rsi_lte',
    initialMessage: 'BTC 1h，RSI 跌破 25 开多，RSI 上穿 75 平仓',
    patch: buildPatch({
      triggers: [
        { key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 25 } },
        { key: 'oscillator.rsi_gte', phase: 'exit', params: { threshold: 75 } },
      ],
    }),
  },
  {
    label: 'rsi_lte-b-synonym',
    family: 'oscillator.rsi_lte',
    initialMessage: '当 RSI 低于 20 时进场做多 ETH 4h，达到 80 离场',
    patch: buildPatch({
      triggers: [
        { key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 20 } },
        { key: 'oscillator.rsi_gte', phase: 'exit', params: { threshold: 80 } },
      ],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'rsi_gte-a-short',
    family: 'oscillator.rsi_gte',
    initialMessage: 'SOL 15m，RSI 超过 70 做空，回到 30 以下平空',
    patch: buildPatch({
      triggers: [
        { key: 'oscillator.rsi_gte', phase: 'entry', sideScope: 'short', params: { threshold: 70 } },
        { key: 'oscillator.rsi_lte', phase: 'exit', sideScope: 'short', params: { threshold: 30 } },
      ],
      actions: [{ key: 'open_short' }, { key: 'close_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'SOLUSDT', timeframe: '15m' },
    }),
  },
  {
    label: 'rsi_gte-b-reordered',
    family: 'oscillator.rsi_gte',
    initialMessage: '阈值 65，RSI 高于该值时 BTC 4h 做空',
    patch: buildPatch({
      triggers: [
        { key: 'oscillator.rsi_gte', phase: 'entry', sideScope: 'short', params: { threshold: 65 } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
    }),
  },

  // -- indicator.cross_over / cross_under（4 条） --
  {
    label: 'cross_over-a',
    family: 'indicator.cross_over',
    initialMessage: 'BTC 1h，EMA12 上穿 EMA26 开多，下穿平仓',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.cross_over', phase: 'entry', params: { fastPeriod: 12, slowPeriod: 26, indicator: 'ema' } },
        { key: 'indicator.cross_under', phase: 'exit', params: { fastPeriod: 12, slowPeriod: 26, indicator: 'ema' } },
      ],
    }),
  },
  {
    label: 'cross_over-b-synonym',
    family: 'indicator.cross_over',
    initialMessage: 'ETH 4h，MA5 金叉 MA20 进场，死叉离场',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.cross_over', phase: 'entry', params: { fastPeriod: 5, slowPeriod: 20, indicator: 'sma' } },
        { key: 'indicator.cross_under', phase: 'exit', params: { fastPeriod: 5, slowPeriod: 20, indicator: 'sma' } },
      ],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'cross_under-a-short',
    family: 'indicator.cross_under',
    initialMessage: 'BTC 1d，EMA20 下穿 EMA50 做空',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.cross_under', phase: 'entry', sideScope: 'short', params: { fastPeriod: 20, slowPeriod: 50, indicator: 'ema' } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '1d' },
    }),
  },
  {
    label: 'cross_under-b-exit-long',
    family: 'indicator.cross_under',
    initialMessage: 'SOL 1h，EMA10 死叉 EMA30 时立即平掉所有多仓',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.cross_under', phase: 'exit', params: { fastPeriod: 10, slowPeriod: 30, indicator: 'ema' } },
      ],
      actions: [{ key: 'close_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'SOLUSDT', timeframe: '1h' },
    }),
  },

  // -- bollinger.touch_upper / lower / middle（4 条） --
  {
    label: 'bollinger.touch_lower-a',
    family: 'bollinger.touch_lower',
    initialMessage: 'BTC 4h 触及布林下轨开多',
    patch: buildPatch({
      triggers: [
        { key: 'bollinger.touch_lower', phase: 'entry', params: { period: 20, stdDev: 2 } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'bollinger.touch_lower-b-synonym',
    family: 'bollinger.touch_lower',
    initialMessage: '价格接触到布林带下沿就买入 ETH 1h',
    patch: buildPatch({
      triggers: [
        { key: 'bollinger.touch_lower', phase: 'entry', params: { period: 20, stdDev: 2 } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '1h' },
    }),
  },
  {
    label: 'bollinger.touch_upper-a-short',
    family: 'bollinger.touch_upper',
    initialMessage: 'BTC 1h 触及布林上轨做空',
    patch: buildPatch({
      triggers: [
        { key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short', params: { period: 20, stdDev: 2 } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
    }),
  },
  {
    label: 'bollinger.touch_middle-a-exit',
    family: 'bollinger.touch_middle',
    initialMessage: 'BTC 1h，价格回到布林中轨止盈平仓',
    patch: buildPatch({
      triggers: [
        { key: 'bollinger.touch_middle', phase: 'exit', params: { period: 20, stdDev: 2 } },
      ],
      actions: [{ key: 'close_long' }],
    }),
  },

  // -- price.breakout / percent_change（4 条） --
  {
    label: 'price.breakout_up-a',
    family: 'price.breakout_up',
    initialMessage: 'BTC 1h 突破近 20 根 K 线最高点开多',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
    }),
  },
  {
    label: 'price.breakout_up-b-synonym',
    family: 'price.breakout_up',
    initialMessage: 'ETH 4h 上穿历史前高 50 根，开多',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 50 } }],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'price.breakout_down-a-short',
    family: 'price.breakout_down',
    initialMessage: 'SOL 1h 跌破近 30 根 K 线最低点做空',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_down', phase: 'entry', sideScope: 'short', params: { period: 30 } }],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'SOLUSDT', timeframe: '1h' },
    }),
  },
  {
    label: 'price.percent_change-a',
    family: 'price.percent_change',
    initialMessage: 'BTC 1h，过去 1 小时涨幅超过 3% 开多',
    patch: buildPatch({
      triggers: [{ key: 'price.percent_change', phase: 'entry', params: { lookback: 1, thresholdPct: 3 } }],
      actions: [{ key: 'open_long' }],
    }),
  },

  // -- action.* （4 条：open_long / close_long / open_short / add_position） --
  {
    label: 'action.open_short-a',
    family: 'action.open_short',
    initialMessage: 'BTC 1h，价格触及布林上沿后立即做空',
    patch: buildPatch({
      triggers: [
        { key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short', params: { period: 20, stdDev: 2 } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
    }),
  },
  {
    label: 'action.close_short-a',
    family: 'action.close_short',
    initialMessage: 'BTC 1h，RSI 跌破 30 时平掉所有空仓',
    patch: buildPatch({
      triggers: [
        { key: 'oscillator.rsi_lte', phase: 'exit', sideScope: 'short', params: { threshold: 30 } },
      ],
      actions: [{ key: 'close_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
    }),
  },
  {
    label: 'action.add_position-a',
    family: 'action.add_position',
    initialMessage: 'ETH 1d 定投基础仓位，回撤 5% 时再加投',
    patch: buildPatch({
      triggers: [{ key: 'execution.on_start', phase: 'entry', params: {} }],
      actions: [
        { key: 'action.add_position', params: { trigger: { kind: 'drawdown_pct', threshold: 5 }, addRatio: 1 } },
      ],
      position: { mode: 'fixed_amount', value: 100, positionMode: 'long_only' },
      contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'ETHUSDT', timeframe: '1d' },
    }),
  },
  {
    label: 'action.add_position-b-profit',
    family: 'action.add_position',
    initialMessage: 'BTC 1h 突破前高建仓，每盈利 3% 加仓一次',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [
        { key: 'open_long' },
        { key: 'action.add_position', params: { trigger: { kind: 'profit_pct', threshold: 3 }, addRatio: 0.5 } },
      ],
    }),
  },

  // -- position.* （3 条：pyramiding_limit / dca_schedule + 同义词） --
  {
    label: 'position.pyramiding_limit-a',
    family: 'position.pyramiding_limit',
    initialMessage: 'BTC 1h 突破开多，最多分 3 层加仓',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        constraints: [{ key: 'position.pyramiding_limit', params: { maxLayers: 3 }, status: 'locked' }],
      },
    }),
  },
  {
    label: 'position.pyramiding_limit-b-synonym',
    family: 'position.pyramiding_limit',
    initialMessage: 'ETH 4h，限制最大加仓层数为 5 层',
    patch: buildPatch({
      triggers: [{ key: 'execution.on_start', phase: 'entry', params: {} }],
      actions: [{ key: 'open_long' }],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        constraints: [{ key: 'position.pyramiding_limit', params: { maxLayers: 5 }, status: 'locked' }],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'position.dca_schedule-a',
    family: 'position.dca_schedule',
    initialMessage: 'ETH 现货每天 100 USDT 定投，最多 30 次',
    patch: buildPatch({
      triggers: [{ key: 'execution.on_start', phase: 'entry', params: {} }],
      actions: [{ key: 'action.add_position', params: { trigger: { kind: 'time_interval', threshold: 86400 }, addRatio: 1 } }],
      position: {
        mode: 'fixed_amount',
        value: 100,
        positionMode: 'long_only',
        constraints: [{ key: 'position.dca_schedule', params: { maxCount: 30 }, status: 'locked' }],
      },
      contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'ETHUSDT', timeframe: '1d' },
    }),
  },

  // -- risk.* （3 条：stop_loss / partial_take_profit + 参数换序） --
  {
    label: 'risk.stop_loss_pct-a',
    family: 'risk.stop_loss_pct',
    initialMessage: 'BTC 1h，RSI 跌破 30 开多，止损 1.5%',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 30 } }],
      actions: [{ key: 'open_long' }],
      risk: [{ key: 'risk.stop_loss_pct', params: { valuePct: 1.5, basis: 'entry_avg_price' } }],
    }),
  },
  {
    label: 'risk.stop_loss_pct-b-reordered',
    family: 'risk.stop_loss_pct',
    initialMessage: '止损先定 3%，再说策略：ETH 4h 突破开多',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      risk: [{ key: 'risk.stop_loss_pct', params: { valuePct: 3, basis: 'entry_avg_price' } }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'risk.partial_take_profit-a',
    family: 'risk.partial_take_profit',
    initialMessage: 'BTC 1h 开多后，盈利 5% 平掉一半',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      risk: [
        { key: 'risk.partial_take_profit', params: { triggerPct: 5, closeRatio: 0.5, basis: 'entry_avg_price' } },
      ],
    }),
  },

  // -- portfolioRisk.* （3 条：drawdown_block / symbol_exposure_cap + 同义词） --
  {
    label: 'portfolioRisk.drawdown_block-a',
    family: 'portfolioRisk.drawdown_block',
    initialMessage: 'BTC 1h 突破开多，账户回撤超过 10% 全部熔断',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'portfolioRisk',
            key: 'portfolioRisk.drawdown_block',
            params: { thresholdPct: 10 },
            scope: 'portfolio',
            mode: 'enforce',
            thresholdPct: 10,
            status: 'locked',
          },
        ],
      },
    }),
  },
  {
    label: 'portfolioRisk.drawdown_block-b-synonym',
    family: 'portfolioRisk.drawdown_block',
    initialMessage: 'ETH 4h RSI 反转开多，最大回撤 20% 即熔断',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 25 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'portfolioRisk',
            key: 'portfolioRisk.drawdown_block',
            params: { thresholdPct: 20 },
            scope: 'portfolio',
            mode: 'enforce',
            thresholdPct: 20,
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'portfolioRisk.symbol_exposure_cap-a',
    family: 'portfolioRisk.symbol_exposure_cap',
    initialMessage: 'BTC 1h 突破开多，单币种敞口最多占组合 30%',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'portfolioRisk',
            key: 'portfolioRisk.symbol_exposure_cap',
            params: { capPct: 30 },
            scope: 'symbol',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },

  // -- program / grid（2 条：grid.range_rebalance + program.dynamic_grid） --
  {
    label: 'grid.range_rebalance-a',
    family: 'grid.range_rebalance',
    initialMessage: 'BTC 现货区间 50000-60000 挂 10 格，每格 50 USDT',
    patch: buildPatch({
      triggers: [
        {
          key: 'grid.range_rebalance',
          phase: 'entry',
          params: { lower: 50000, upper: 60000, gridCount: 10, perOrderBudget: 50 },
        },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      position: { mode: 'fixed_amount', value: 50, positionMode: 'long_only' },
      contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'BTCUSDT', timeframe: '1h' },
    }),
  },
  {
    label: 'grid.range_rebalance-b-reordered',
    family: 'grid.range_rebalance',
    initialMessage: '每格预算 80 USDT，挂 25 格，ETH 区间 2000-3000',
    patch: buildPatch({
      triggers: [
        {
          key: 'grid.range_rebalance',
          phase: 'entry',
          params: { lower: 2000, upper: 3000, gridCount: 25, perOrderBudget: 80 },
        },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      position: { mode: 'fixed_amount', value: 80, positionMode: 'long_only' },
      contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'ETHUSDT', timeframe: '1h' },
    }),
  },

  // -- Wave 1B 补强 39 条：达到 70/70 完整覆盖 --

  // bollinger.touch_upper-b（同义词 / 入场短）+ touch_middle-b（入场再加）
  {
    label: 'bollinger.touch_upper-b-synonym',
    family: 'bollinger.touch_upper',
    initialMessage: 'ETH 4h 价格碰到布林上沿即做空',
    patch: buildPatch({
      triggers: [
        { key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short', params: { period: 20, stdDev: 2 } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'bollinger.touch_middle-b-entry',
    family: 'bollinger.touch_middle',
    initialMessage: 'BTC 4h 价格上穿布林中轨开多',
    patch: buildPatch({
      triggers: [
        { key: 'bollinger.touch_middle', phase: 'entry', params: { period: 20, stdDev: 2 } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
    }),
  },

  // price.breakout_down-b + percent_change-b
  {
    label: 'price.breakout_down-b-synonym',
    family: 'price.breakout_down',
    initialMessage: 'BTC 4h 跌破近 50 根 K 线的最低点平掉所有多仓',
    patch: buildPatch({
      triggers: [
        { key: 'price.breakout_down', phase: 'exit', params: { period: 50 } },
      ],
      actions: [{ key: 'close_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'price.percent_change-b-short',
    family: 'price.percent_change',
    initialMessage: 'ETH 15m，5 分钟内跌幅超过 2% 做空',
    patch: buildPatch({
      triggers: [
        { key: 'price.percent_change', phase: 'entry', sideScope: 'short', params: { lookback: 5, thresholdPct: -2 } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '15m' },
    }),
  },

  // action.open_long / close_long 显式变体
  {
    label: 'action.open_long-explicit',
    family: 'action.open_long',
    initialMessage: 'BTC 1h，EMA10 上穿 EMA30 开多',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.cross_over', phase: 'entry', params: { fastPeriod: 10, slowPeriod: 30, indicator: 'ema' } },
      ],
      actions: [{ key: 'open_long' }],
    }),
  },
  {
    label: 'action.close_long-explicit',
    family: 'action.close_long',
    initialMessage: 'BTC 1h，RSI 上穿 75 时清空多仓',
    patch: buildPatch({
      triggers: [
        { key: 'oscillator.rsi_gte', phase: 'exit', params: { threshold: 75 } },
      ],
      actions: [{ key: 'close_long' }],
    }),
  },

  // action.reverse_position
  {
    label: 'action.reverse_position-a',
    family: 'action.reverse_position',
    initialMessage: 'BTC 1h，EMA10 死叉 EMA30 时多翻空',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.cross_under', phase: 'entry', params: { fastPeriod: 10, slowPeriod: 30, indicator: 'ema' } },
      ],
      actions: [{ key: 'action.reverse_position', params: { fromSide: 'long', toSide: 'short' } }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_short' },
    }),
  },
  {
    label: 'action.reverse_position-b',
    family: 'action.reverse_position',
    initialMessage: 'ETH 4h，RSI 跌破 30 时空翻多',
    patch: buildPatch({
      triggers: [
        { key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 30 } },
      ],
      actions: [{ key: 'action.reverse_position', params: { fromSide: 'short', toSide: 'long' } }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_short' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // position.dca_schedule-b
  {
    label: 'position.dca_schedule-b-weekly',
    family: 'position.dca_schedule',
    initialMessage: 'BTC 现货每周 200 USDT 定投，最多 52 周',
    patch: buildPatch({
      triggers: [{ key: 'execution.on_start', phase: 'entry', params: {} }],
      actions: [{ key: 'action.add_position', params: { trigger: { kind: 'time_interval', threshold: 604800 }, addRatio: 1 } }],
      position: {
        mode: 'fixed_amount',
        value: 200,
        positionMode: 'long_only',
        constraints: [{ key: 'position.dca_schedule', params: { maxCount: 52 }, status: 'locked' }],
      },
      contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'BTCUSDT', timeframe: '1d' },
    }),
  },

  // risk.partial_take_profit-b（参数换序）
  {
    label: 'risk.partial_take_profit-b-reordered',
    family: 'risk.partial_take_profit',
    initialMessage: '盈利 8% 时先平 30%，ETH 4h 突破开多',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 30 } }],
      actions: [{ key: 'open_long' }],
      risk: [
        { key: 'risk.partial_take_profit', params: { triggerPct: 8, closeRatio: 0.3, basis: 'entry_avg_price' } },
      ],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // risk.stop_loss_pct-c（basis 换法）
  {
    label: 'risk.stop_loss_pct-c-trailing',
    family: 'risk.stop_loss_pct',
    initialMessage: 'BTC 1h 突破开多，移动止损 2% 跟随最高价',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      risk: [{ key: 'risk.stop_loss_pct', params: { valuePct: 2, basis: 'highest_since_entry' } }],
    }),
  },

  // risk.falling_knife_guard
  {
    label: 'risk.falling_knife_guard-a',
    family: 'risk.falling_knife_guard',
    initialMessage: 'BTC 1h 抄底，但 1 小时跌幅超过 5% 禁止开仓',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 25 } }],
      actions: [{ key: 'open_long' }],
      risk: [{ key: 'risk.falling_knife_guard', params: { lookbackBars: 1, dropPct: 5 } }],
    }),
  },
  {
    label: 'risk.falling_knife_guard-b-synonym',
    family: 'risk.falling_knife_guard',
    initialMessage: 'ETH 4h 反弹买入，避免接飞刀（4 小时下跌 8% 跳过）',
    patch: buildPatch({
      triggers: [{ key: 'bollinger.touch_lower', phase: 'entry', params: { period: 20, stdDev: 2 } }],
      actions: [{ key: 'open_long' }],
      risk: [{ key: 'risk.falling_knife_guard', params: { lookbackBars: 4, dropPct: 8 } }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // portfolioRisk.symbol_exposure_cap-b
  {
    label: 'portfolioRisk.symbol_exposure_cap-b-reordered',
    family: 'portfolioRisk.symbol_exposure_cap',
    initialMessage: '单币种敞口上限 25%，ETH 4h RSI 反转开多',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 30 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'portfolioRisk',
            key: 'portfolioRisk.symbol_exposure_cap',
            params: { capPct: 25 },
            scope: 'symbol',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // portfolioRisk.substrategy_exposure_cap
  {
    label: 'portfolioRisk.substrategy_exposure_cap-a',
    family: 'portfolioRisk.substrategy_exposure_cap',
    initialMessage: '组合内每个子策略最多占 20%，BTC 1h 突破开多',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'portfolioRisk',
            key: 'portfolioRisk.substrategy_exposure_cap',
            params: { capPct: 20 },
            scope: 'subStrategy',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },
  {
    label: 'portfolioRisk.substrategy_exposure_cap-b-synonym',
    family: 'portfolioRisk.substrategy_exposure_cap',
    initialMessage: '子策略权重最大 15%，ETH 4h RSI 反转开多',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 28 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'portfolioRisk',
            key: 'portfolioRisk.substrategy_exposure_cap',
            params: { capPct: 15 },
            scope: 'subStrategy',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // portfolioRisk.drawdown_block-c（reorder：先讲熔断再讲策略）
  {
    label: 'portfolioRisk.drawdown_block-c-reordered',
    family: 'portfolioRisk.drawdown_block',
    initialMessage: '账户回撤 12% 立刻熔断，SOL 1d RSI 反转开多',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 30 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'portfolioRisk',
            key: 'portfolioRisk.drawdown_block',
            params: { thresholdPct: 12 },
            scope: 'portfolio',
            mode: 'enforce',
            thresholdPct: 12,
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'SOLUSDT', timeframe: '1d' },
    }),
  },

  // oscillator.divergence
  {
    label: 'oscillator.divergence-a-rsi-bullish',
    family: 'oscillator.divergence',
    initialMessage: 'BTC 4h，RSI 出现底背离时开多',
    patch: buildPatch({
      triggers: [
        { key: 'oscillator.divergence', phase: 'entry', params: { indicator: 'rsi', direction: 'bullish', pivotWindow: 14, confirmationBars: 3 } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'oscillator.divergence-b-macd-bearish',
    family: 'oscillator.divergence',
    initialMessage: 'ETH 1d，MACD 顶背离做空',
    patch: buildPatch({
      triggers: [
        { key: 'oscillator.divergence', phase: 'entry', sideScope: 'short', params: { indicator: 'macd', direction: 'bearish', pivotWindow: 14, confirmationBars: 3 } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '1d' },
    }),
  },

  // indicator.above / below
  {
    label: 'indicator.above-a',
    family: 'indicator.above',
    initialMessage: 'BTC 1d，价格站上 MA200 上方开多',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.above', phase: 'entry', params: { indicator: 'sma', period: 200 } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '1d' },
    }),
  },
  {
    label: 'indicator.above-b-synonym',
    family: 'indicator.above',
    initialMessage: 'ETH 4h，价格在 EMA50 之上才允许开多',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.above', phase: 'entry', params: { indicator: 'ema', period: 50 } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'indicator.below-a',
    family: 'indicator.below',
    initialMessage: 'BTC 1h，价格跌破 EMA20 下方平多',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.below', phase: 'exit', params: { indicator: 'ema', period: 20 } },
      ],
      actions: [{ key: 'close_long' }],
    }),
  },
  {
    label: 'indicator.below-b-short',
    family: 'indicator.below',
    initialMessage: 'SOL 4h，价格在 MA100 下方做空',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.below', phase: 'entry', sideScope: 'short', params: { indicator: 'sma', period: 100 } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'SOLUSDT', timeframe: '4h' },
    }),
  },

  // price.candle_pattern
  {
    label: 'price.candle_pattern-a-engulfing',
    family: 'price.candle_pattern',
    initialMessage: 'BTC 4h 看涨吞没形态开多',
    patch: buildPatch({
      triggers: [
        { key: 'price.candle_pattern', phase: 'entry', params: { pattern: 'engulfing', direction: 'bullish' } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'price.candle_pattern-b-hammer',
    family: 'price.candle_pattern',
    initialMessage: 'ETH 1h 锤子线出现时开多',
    patch: buildPatch({
      triggers: [
        { key: 'price.candle_pattern', phase: 'entry', params: { pattern: 'hammer', direction: 'bullish' } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '1h' },
    }),
  },

  // price.chart_pattern
  {
    label: 'price.chart_pattern-a-double_bottom',
    family: 'price.chart_pattern',
    initialMessage: 'BTC 1d 双底形态确认后开多',
    patch: buildPatch({
      triggers: [
        { key: 'price.chart_pattern', phase: 'entry', params: { pattern: 'double_bottom', direction: 'bullish' } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '1d' },
    }),
  },
  {
    label: 'price.chart_pattern-b-head_shoulders',
    family: 'price.chart_pattern',
    initialMessage: 'ETH 4h 头肩顶形态确认做空',
    patch: buildPatch({
      triggers: [
        { key: 'price.chart_pattern', phase: 'entry', sideScope: 'short', params: { pattern: 'head_shoulders', direction: 'bearish' } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // liquidity.sweep
  {
    label: 'liquidity.sweep-a',
    family: 'liquidity.sweep',
    initialMessage: 'BTC 15m 流动性扫荡前低后反向开多',
    patch: buildPatch({
      triggers: [
        { key: 'liquidity.sweep', phase: 'entry', params: { side: 'low', lookback: 20 } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '15m' },
    }),
  },
  {
    label: 'liquidity.sweep-b-short',
    family: 'liquidity.sweep',
    initialMessage: 'ETH 1h 扫掉前高停损单后做空',
    patch: buildPatch({
      triggers: [
        { key: 'liquidity.sweep', phase: 'entry', sideScope: 'short', params: { side: 'high', lookback: 30 } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '1h' },
    }),
  },

  // external.signal
  {
    label: 'external.signal-a-tradingview',
    family: 'external.signal',
    initialMessage: '接收 TradingView 网络钩子信号后开多',
    patch: buildPatch({
      triggers: [
        { key: 'external.signal', phase: 'entry', params: { provider: 'tradingview', signalId: 'BTC_PERP_LONG_01', secret: 'tv-secret-placeholder' } },
      ],
      actions: [{ key: 'open_long' }],
    }),
  },
  {
    label: 'external.signal-b-webhook',
    family: 'external.signal',
    initialMessage: '接收自建 Webhook 信号后平仓',
    patch: buildPatch({
      triggers: [
        { key: 'external.signal', phase: 'exit', params: { provider: 'webhook', signalId: 'custom-webhook-001', secret: 'webhook-secret-placeholder' } },
      ],
      actions: [{ key: 'close_long' }],
    }),
  },

  // program.fixed_grid_gated
  {
    label: 'program.fixed_grid_gated-a',
    family: 'program.fixed_grid_gated',
    initialMessage: 'BTC 现货 50000-60000 挂 10 格，仅在 ADX < 25 时启用',
    patch: buildPatch({
      triggers: [
        { key: 'grid.range_rebalance', phase: 'entry', params: { lower: 50000, upper: 60000, gridCount: 10, perOrderBudget: 50 } },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      position: { mode: 'fixed_amount', value: 50, positionMode: 'long_only' },
      orchestration: {
        nodes: [
          {
            kind: 'program',
            key: 'program.fixed_grid_gated',
            params: { gate: { indicator: 'adx', op: 'lt', threshold: 25 } },
            scope: 'symbol',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'BTCUSDT', timeframe: '1h' },
    }),
  },
  {
    label: 'program.fixed_grid_gated-b',
    family: 'program.fixed_grid_gated',
    initialMessage: 'ETH 现货 2000-3000 挂 20 格，仅震荡市启用',
    patch: buildPatch({
      triggers: [
        { key: 'grid.range_rebalance', phase: 'entry', params: { lower: 2000, upper: 3000, gridCount: 20, perOrderBudget: 60 } },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      position: { mode: 'fixed_amount', value: 60, positionMode: 'long_only' },
      orchestration: {
        nodes: [
          {
            kind: 'program',
            key: 'program.fixed_grid_gated',
            params: { gate: { regime: 'range' } },
            scope: 'symbol',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'ETHUSDT', timeframe: '1h' },
    }),
  },

  // program.adaptive_volatility_grid
  {
    label: 'program.adaptive_volatility_grid-a',
    family: 'program.adaptive_volatility_grid',
    initialMessage: 'BTC 现货按 ATR 自适应网格宽度，每格 100 USDT',
    patch: buildPatch({
      triggers: [
        { key: 'grid.range_rebalance', phase: 'entry', params: { lower: 0, upper: 0, gridCount: 12, perOrderBudget: 100 } },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      position: { mode: 'fixed_amount', value: 100, positionMode: 'long_only' },
      orchestration: {
        nodes: [
          {
            kind: 'program',
            key: 'program.adaptive_volatility_grid',
            params: { atrPeriod: 14, widthAtrMultiplier: 1.5 },
            scope: 'symbol',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'BTCUSDT', timeframe: '1h' },
    }),
  },
  {
    label: 'program.adaptive_volatility_grid-b',
    family: 'program.adaptive_volatility_grid',
    initialMessage: 'ETH 现货自适应波动率网格，ATR 调宽 2 倍',
    patch: buildPatch({
      triggers: [
        { key: 'grid.range_rebalance', phase: 'entry', params: { lower: 0, upper: 0, gridCount: 16, perOrderBudget: 80 } },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      position: { mode: 'fixed_amount', value: 80, positionMode: 'long_only' },
      orchestration: {
        nodes: [
          {
            kind: 'program',
            key: 'program.adaptive_volatility_grid',
            params: { atrPeriod: 20, widthAtrMultiplier: 2 },
            scope: 'symbol',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'ETHUSDT', timeframe: '1h' },
    }),
  },

  // program.event_listener
  {
    label: 'program.event_listener-a',
    family: 'program.event_listener',
    initialMessage: '美联储议息事件时暂停 BTC 1h 突破策略',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'program',
            key: 'program.event_listener',
            params: { events: ['fomc'], action: 'pause' },
            scope: 'portfolio',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },
  {
    label: 'program.event_listener-b',
    family: 'program.event_listener',
    initialMessage: 'CPI 数据公布事件时暂停 ETH 4h 策略',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 28 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'program',
            key: 'program.event_listener',
            params: { events: ['cpi'], action: 'pause' },
            scope: 'portfolio',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // gate.regime
  {
    label: 'gate.regime-a',
    family: 'gate.regime',
    initialMessage: 'BTC 1h 突破策略仅在趋势市启用',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'gate',
            key: 'gate.regime',
            params: { regime: 'trend' },
            scope: 'symbol',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },
  {
    label: 'gate.regime-b',
    family: 'gate.regime',
    initialMessage: 'ETH 4h 反转策略仅在震荡市启用',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 25 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'gate',
            key: 'gate.regime',
            params: { regime: 'range' },
            scope: 'symbol',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // gate.subStrategy
  {
    label: 'gate.subStrategy-a',
    family: 'gate.subStrategy',
    initialMessage: '子策略只有在主策略持仓时才启用',
    patch: buildPatch({
      triggers: [{ key: 'execution.on_start', phase: 'entry', params: {} }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'gate',
            key: 'gate.subStrategy',
            params: { parentStrategyId: 'parent-strategy-1', condition: 'has_position' },
            scope: 'subStrategy',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },
  {
    label: 'gate.subStrategy-b',
    family: 'gate.subStrategy',
    initialMessage: '当父策略空仓时禁用本子策略',
    patch: buildPatch({
      triggers: [{ key: 'execution.on_start', phase: 'entry', params: {} }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'gate',
            key: 'gate.subStrategy',
            params: { parentStrategyId: 'parent-strategy-2', condition: 'no_position' },
            scope: 'subStrategy',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },

  // scope.symbol
  {
    label: 'scope.symbol-a',
    family: 'scope.symbol',
    initialMessage: '本策略仅在 BTC 上运行，1h 突破开多',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'scope',
            key: 'scope.symbol',
            params: { symbols: ['BTCUSDT'] },
            scope: 'symbol',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },
  {
    label: 'scope.symbol-b-multi',
    family: 'scope.symbol',
    initialMessage: '策略仅作用于 BTC 与 ETH，4h RSI 反转开多',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 28 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'scope',
            key: 'scope.symbol',
            params: { symbols: ['BTCUSDT', 'ETHUSDT'] },
            scope: 'symbol',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // scope.timeframe
  {
    label: 'scope.timeframe-a',
    family: 'scope.timeframe',
    initialMessage: '策略仅在 1h timeframe 运行',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'scope',
            key: 'scope.timeframe',
            params: { timeframes: ['1h'] },
            scope: 'timeframe',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },
  {
    label: 'scope.timeframe-b',
    family: 'scope.timeframe',
    initialMessage: '策略锁定在 4h 与 1d 周期',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 30 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'scope',
            key: 'scope.timeframe',
            params: { timeframes: ['4h', '1d'] },
            scope: 'timeframe',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
    }),
  },

  // scope.leg
  {
    label: 'scope.leg-a',
    family: 'scope.leg',
    initialMessage: '本子腿仅负责做多 BTC 1h，参与组合 long_leg',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'scope',
            key: 'scope.leg',
            params: { legId: 'long_leg', side: 'long' },
            scope: 'leg',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },
  {
    label: 'scope.leg-b-short',
    family: 'scope.leg',
    initialMessage: '本子腿仅做空 ETH 4h，组合 short_leg',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_gte', phase: 'entry', sideScope: 'short', params: { threshold: 72 } }],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      orchestration: {
        nodes: [
          {
            kind: 'scope',
            key: 'scope.leg',
            params: { legId: 'short_leg', side: 'short' },
            scope: 'leg',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // scope.dataSource
  {
    label: 'scope.dataSource-a',
    family: 'scope.dataSource',
    initialMessage: '行情仅取 OKX，BTC 1h 突破开多',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'scope',
            key: 'scope.dataSource',
            params: { dataSources: ['okx'] },
            scope: 'dataSource',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },
  {
    label: 'scope.dataSource-b-multi',
    family: 'scope.dataSource',
    initialMessage: '行情同时订阅 OKX 与 Binance，ETH 4h RSI 反转开多',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 30 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'scope',
            key: 'scope.dataSource',
            params: { dataSources: ['okx', 'binance'] },
            scope: 'dataSource',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },

  // scope.subStrategy
  {
    label: 'scope.subStrategy-a',
    family: 'scope.subStrategy',
    initialMessage: '本规则仅作用于趋势子策略，1h 突破开多',
    patch: buildPatch({
      triggers: [{ key: 'price.breakout_up', phase: 'entry', params: { period: 20 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'scope',
            key: 'scope.subStrategy',
            params: { subStrategyIds: ['trend-sub'] },
            scope: 'subStrategy',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
    }),
  },
  {
    label: 'scope.subStrategy-b',
    family: 'scope.subStrategy',
    initialMessage: '本规则仅作用于均值回归子策略组合，4h RSI 反转开多',
    patch: buildPatch({
      triggers: [{ key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 28 } }],
      actions: [{ key: 'open_long' }],
      orchestration: {
        nodes: [
          {
            kind: 'scope',
            key: 'scope.subStrategy',
            params: { subStrategyIds: ['mean-reversion-sub', 'breakout-sub'] },
            scope: 'subStrategy',
            mode: 'enforce',
            status: 'locked',
          },
        ],
      },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
    }),
  },

  // action.open_short-b / close_short-b（补 ≥2 变体）
  {
    label: 'action.open_short-b',
    family: 'action.open_short',
    initialMessage: 'BTC 4h 趋势下行直接开空',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.cross_under', phase: 'entry', sideScope: 'short', params: { fastPeriod: 20, slowPeriod: 60, indicator: 'ema' } },
      ],
      actions: [{ key: 'open_short' }],
      position: { mode: 'fixed_ratio', value: 0.15, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'action.close_short-b',
    family: 'action.close_short',
    initialMessage: 'ETH 1h，EMA 金叉时清空空仓',
    patch: buildPatch({
      triggers: [
        { key: 'indicator.cross_over', phase: 'exit', sideScope: 'short', params: { fastPeriod: 12, slowPeriod: 26, indicator: 'ema' } },
      ],
      actions: [{ key: 'close_short' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '1h' },
    }),
  },

  // action.open_long-b / close_long-b（补 ≥2 显式变体）
  {
    label: 'action.open_long-b-rsi',
    family: 'action.open_long',
    initialMessage: 'BTC 4h，RSI 跌破 25 显式开多',
    patch: buildPatch({
      triggers: [
        { key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 25 } },
      ],
      actions: [{ key: 'open_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
    }),
  },
  {
    label: 'action.close_long-b-bb',
    family: 'action.close_long',
    initialMessage: 'ETH 4h，触及布林上轨时显式平多',
    patch: buildPatch({
      triggers: [
        { key: 'bollinger.touch_upper', phase: 'exit', params: { period: 20, stdDev: 2 } },
      ],
      actions: [{ key: 'close_long' }],
      contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '4h' },
    }),
  },
]

// ---------------------------------------------------------------------------

describe('AC-8 扩展 prompt e2e 矩阵 (86 prompts — Wave 1B 收口，超 70 目标)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let aiService: AiService
  const leakGuard = new InternalKeyLeakGuardService()

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.e2e.local', '.env.e2e'],
        }),
        EventEmitterModule.forRoot(),
        EnvModule,
        ClsConfigModule,
        LlmStrategyCodegenModule,
      ],
    })
      .overrideProvider(MarketDataIngestionService)
      .useValue({
        onModuleInit: () => {},
        onModuleDestroy: () => {},
        handleGapFill: () => {},
        handleDynamicSymbolRefresh: () => {},
      })
      .overrideProvider(MarketSymbolCatalogService)
      .useValue({
        onApplicationBootstrap: () => {},
        ensureExchangeSymbolAvailable: async () => 'supported',
      })
      .overrideProvider(CallerIdentityService)
      .useValue({
        async resolveCallerUserIdFromAuthorization(authorization?: string) {
          const token = authorization?.replace(/^Bearer\s+/i, '').trim()
          if (!token) throw new Error('missing bearer token for test')
          return token
        },
      })
      .overrideProvider(EnvService)
      .useValue({
        getString: (key: string) => process.env[key] ?? process.env[`QUANTIFY_${key}`],
        isProd: () => false,
        isDev: () => false,
        isTest: () => true,
        isE2E: () => true,
        isDebugMode: () => false,
        getNumber: () => undefined,
        getBoolean: () => undefined,
      })
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.setGlobalPrefix('api/v1')
    await app.init()

    prisma = moduleFixture.get(PrismaService)
    aiService = moduleFixture.get(AiService)
  })

  afterEach(async () => {
    await prisma.llmStrategyCodeVersion.deleteMany()
    await prisma.llmStrategyCodegenSession.deleteMany()
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await app.close()
  })

  async function runPromptAndAssertLeakGuard(c: PromptCase, userId: string): Promise<void> {
    jest.spyOn(aiService, 'chat').mockResolvedValueOnce({ content: c.patch })

    const server = app.getHttpServer()
    const res = await supertestRequest(server)
      .post(buildApiUrl('llm-strategy-codegen/sessions'))
      .send({ userId, initialMessage: c.initialMessage })
      .set(withBearer(userId))
      .expect(201)

    const payload = (res.body.data ?? res.body) as Record<string, unknown>

    expect(['DRAFTING', 'CONFIRM_GATE']).toContain(payload.status)

    const gate = payload.clarificationGate as { summary: string | null; blocked: boolean } | undefined
    const summaryText = gate?.summary ?? ''
    const assistantPromptText = typeof payload.assistantPrompt === 'string' ? payload.assistantPrompt : ''

    const userFacingTexts = [summaryText, assistantPromptText].filter(t => t.length > 0)
    expect(userFacingTexts.length).toBeGreaterThan(0)

    for (const text of userFacingTexts) {
      const findings = leakGuard.scan(text, { surface: c.label })
      if (findings.length > 0) {
        throw new Error(
          `[${c.label}] InternalKeyLeakGuard 命中：${findings.map(f => `${f.key}@${f.path}`).join(', ')}\ntext: ${text}`,
        )
      }
      expect(findings).toHaveLength(0)
    }
  }

  it.each(PROMPTS.map((c, idx) => [`#${idx + 1} [${c.family}] ${c.label}`, c, idx]))(
    '%s',
    async (_name, c, idx) => {
      await runPromptAndAssertLeakGuard(c as PromptCase, `u-ac8-${idx as number + 1}`)
    },
  )
})
