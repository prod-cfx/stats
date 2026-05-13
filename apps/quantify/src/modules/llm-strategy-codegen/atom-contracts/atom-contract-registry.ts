/**
 * ATOM_CONTRACT_REGISTRY — per-atom 全链路强契约注册表（Issue #1162）
 *
 * 每个 SupportedExecutableUtteranceAtom 必须声明 4 个 hook：
 *   summaryContribution / readinessCheck / clarificationQuestion / mutex
 *
 * TS exhaustive：新增 atom → Record 索引缺失 → 编译失败（守门）
 * 产品决策：risk.partial_take_profit 保持 unsupported 标签（公测），本 registry 仅声明现有 hooks
 */

import type { SupportedExecutableUtteranceAtom } from '../nl-gateway/utterance-corpus/utterance-corpus.types'
import {
  ATOM_MUTEX,
} from '../nl-gateway/utterance-corpus/corpus-invariants'
import {
  COMMON_PIPELINE,
  NO_SUMMARY,
  UNSUPPORTED_SKIP,
  VIA_PRESENTATION_DISPLAY,
  type AtomContract,
  type AtomContractBucket,
  type AtomContractKey,
  type AtomContractDisplay,
  type AtomContractEmit,
  type SizingEvidence,
} from './atom-contract-types'

type AtomContractSeed = Omit<AtomContract, 'key' | 'bucket' | 'display' | 'emit'> & {
  readonly display?: AtomContractDisplay
  readonly emit?: AtomContractEmit
}

export type Pr1bStubIrShapeBuilder = AtomContractEmit['irShape'] & {
  readonly __pr1bStub: true
}

type Pr1bStubEmit = Omit<AtomContractEmit, 'irShape'> & {
  readonly capabilityStatus: 'pr1b-stub'
  readonly irShape: Pr1bStubIrShapeBuilder
}

type CompletedPr1bRegistry<T extends Record<AtomContractKey, AtomContractSeed>> = {
  readonly [K in keyof T]: Omit<T[K], 'display' | 'emit'> & {
    readonly key: K
    readonly bucket: AtomContractBucket
    readonly canonicalWave: 'canonicalWave' extends keyof T[K] ? T[K]['canonicalWave'] : undefined
    readonly display: AtomContractDisplay
    readonly emit: Pr1bStubEmit
  }
}

// Per-order budget capability triple — shared by DCA / pyramiding emit paths.
// Issue #1191：常量名保留 DCA 前缀以维持向后兼容；pyramiding 复用同一三元组，
//   通过 emit shape 顶层 `triggerSource` 字段（'position.dca_schedule' /
//   'position.pyramiding_limit'）区分来源。后续若再有第三个消费者（grid 等），
//   可在 cleanup PR 把常量改名为 PER_ORDER_BUDGET_CAPABILITY。
export const DCA_PER_ORDER_BUDGET_CAPABILITY = {
  domain: 'capital' as const,
  verb: 'allocate' as const,
  object: 'per_order_budget' as const,
}

// DCA per-order sizing evidence (reused by SIZING_BEARING_ATOMS in corpus-invariants)
const DCA_SIZING_EVIDENCE: SizingEvidence = {
  capability: DCA_PER_ORDER_BUDGET_CAPABILITY,
  paramSource: 'perOrderSizing',
}

// Pyramiding layer sizing evidence (Issue #1191) —— capability 三元组与 DCA 一致，
//   paramSource 区分为 `layerSizing`（pyramiding 由 seed-extractor 从"每次加仓 N%"
//   提取的 layerSizing 字段）。
const PYRAMIDING_SIZING_EVIDENCE: SizingEvidence = {
  capability: DCA_PER_ORDER_BUDGET_CAPABILITY,
  paramSource: 'layerSizing',
}

// Grid per-order sizing evidence (Issue #1198) —— capability 三元组与 DCA 一致，
//   paramSource 区分为 `perGridSizing`（grid 由 seed-extractor `buildGridOrderProgramActionContracts`
//   从"每格 N USDT"提取的 perOrderBudget 字段；PR #1197 已恢复顶层 kind/value/asset emit）。
const GRID_SIZING_EVIDENCE: SizingEvidence = {
  capability: DCA_PER_ORDER_BUDGET_CAPABILITY,
  paramSource: 'perGridSizing',
}

export const ATOM_BUCKETS = {
  'volume.threshold': 'trigger',
  'volatility.atr_threshold': 'trigger',
  'strategy.time_window': 'trigger',
  'oscillator.rsi_lte': 'trigger',
  'oscillator.rsi_gte': 'trigger',
  'indicator.divergence': 'trigger',
  'price.candle_pattern': 'trigger',
  'price.chart_pattern': 'trigger',
  'liquidity.sweep': 'trigger',
  'external.signal': 'trigger',
  'position.has_position': 'trigger',
  'position.no_position': 'trigger',
  'bollinger.touch_upper': 'trigger',
  'bollinger.touch_lower': 'trigger',
  'bollinger.touch_middle': 'trigger',
  'price.percent_change': 'trigger',
  'price.breakout_up': 'trigger',
  'price.breakout_down': 'trigger',
  'price.detect.indicator_boundary': 'trigger',
  'indicator.cross_over': 'trigger',
  'indicator.cross_under': 'trigger',
  'indicator.above': 'trigger',
  'indicator.below': 'trigger',
  'execution.on_start': 'trigger',
  'trend.direction': 'trigger',
  'market.regime': 'trigger',
  'volatility.state': 'trigger',
  'price.range_position_lte': 'trigger',
  'price.range_position_gte': 'trigger',
  'action.add_position': 'action',
  'action.reverse_position': 'action',
  'risk.partial_take_profit': 'risk',
  'portfolioRisk.drawdown_block': 'orchestration',
  'position.dca_schedule': 'positionConstraint',
  'position.pyramiding_limit': 'positionConstraint',
  'grid.range_rebalance': 'positionConstraint',
} as const satisfies Record<AtomContractKey, AtomContractBucket>

// Issue #1279 PR1c: 36 atom 的 display.publicName 单一 Record<key, {zh, en}> 真相源
// （review M1：消除 zh / en 双表漂移；review H1：zh 端"卫语句"统一为"护栏"）。
//
// 翻译来源优先级：
//   1. apps/front/public/locales/{zh,en}/common.json 已有 ai-quant 术语（"Max Drawdown" / "Breakout" / "Grid" 等）
//   2. 通用金融术语对照表（"上穿"→"cross above" / "突破"→"breakout" / "区间"→"range" /
//      "网格"→"grid" / "止盈"→"take profit" / "止损"→"stop loss" / "护栏"→"guard"）
//   3. atom semantics 上下文（护栏 = guard、补仓 = DCA schedule、反手 = position reversal）
//
// 不变量（display-publicname-en-coverage.spec.ts 运行时断言）：
//   (1) zh 与 en 均非空  (2) en !== zh  (3) en 不含 CJK 字符
//
// renderer / paramRenderers / summaryTemplate 完整迁移在 PR3c 与 display-token-table 删除原子完成。
const ATOM_PUBLIC_NAMES = {
  'volume.threshold': { zh: '成交量阈值', en: 'Volume threshold' },
  'volatility.atr_threshold': { zh: 'ATR 波动率阈值', en: 'ATR volatility threshold' },
  'strategy.time_window': { zh: '交易时间窗口', en: 'Trading time window' },
  'oscillator.rsi_lte': { zh: 'RSI 低于阈值', en: 'RSI below threshold' },
  'oscillator.rsi_gte': { zh: 'RSI 高于阈值', en: 'RSI above threshold' },
  'indicator.divergence': { zh: '指标背离', en: 'Indicator divergence' },
  'price.candle_pattern': { zh: 'K 线形态', en: 'Candlestick pattern' },
  'price.chart_pattern': { zh: '图形形态', en: 'Chart pattern' },
  'liquidity.sweep': { zh: '流动性扫荡', en: 'Liquidity sweep' },
  'external.signal': { zh: '外部喊单 / Webhook 信号', en: 'Third-party call / Webhook signal' },
  'position.has_position': { zh: '已有仓位护栏', en: 'Has position guard' },
  'position.no_position': { zh: '无仓位护栏', en: 'No position guard' },
  'bollinger.touch_upper': { zh: '触及布林上轨', en: 'Touch Bollinger upper band' },
  'bollinger.touch_lower': { zh: '触及布林下轨', en: 'Touch Bollinger lower band' },
  'bollinger.touch_middle': { zh: '触及布林中轨', en: 'Touch Bollinger middle band' },
  'price.percent_change': { zh: '价格百分比变化', en: 'Price percent change' },
  'price.breakout_up': { zh: '向上突破', en: 'Upside breakout' },
  'price.breakout_down': { zh: '向下跌破', en: 'Downside breakdown' },
  'price.detect.indicator_boundary': { zh: '价格触及指标边界', en: 'Price touch on indicator boundary' },
  'indicator.cross_over': { zh: '指标上穿', en: 'Indicator cross above' },
  'indicator.cross_under': { zh: '指标下穿', en: 'Indicator cross below' },
  'indicator.above': { zh: '指标高于阈值', en: 'Indicator above threshold' },
  'indicator.below': { zh: '指标低于阈值', en: 'Indicator below threshold' },
  'execution.on_start': { zh: '启动后执行', en: 'Run on strategy start' },
  'trend.direction': { zh: '趋势方向', en: 'Trend direction' },
  'market.regime': { zh: '市场状态', en: 'Market regime' },
  'volatility.state': { zh: '波动率状态', en: 'Volatility state' },
  'price.range_position_lte': { zh: '区间低位', en: 'Below range low' },
  'price.range_position_gte': { zh: '区间高位', en: 'Above range high' },
  'action.add_position': { zh: '加仓', en: 'Add to position' },
  'action.reverse_position': { zh: '反手', en: 'Reverse position' },
  'risk.partial_take_profit': { zh: '分批止盈', en: 'Partial take profit' },
  'portfolioRisk.drawdown_block': { zh: '组合回撤护栏', en: 'Portfolio drawdown guard' },
  'position.dca_schedule': { zh: 'DCA 补仓计划', en: 'DCA schedule' },
  'position.pyramiding_limit': { zh: '金字塔加仓限制', en: 'Pyramiding limit' },
  'grid.range_rebalance': { zh: '网格区间再平衡', en: 'Grid range rebalance' },
} as const satisfies Record<AtomContractKey, { zh: string; en: string }>

export { ATOM_PUBLIC_NAMES }

function createPr1bStubIrShape(key: AtomContractKey): Pr1bStubIrShapeBuilder {
  return Object.assign(
    (() => {
      throw new Error(`[#1279 PR1b stub] emit.irShape for ${key} pending PR3a IR compiler refactor`)
    }) as AtomContractEmit['irShape'],
    { __pr1bStub: true as const },
  )
}

// Issue #1279 PR1c: createPr1bDisplay 接受 {zh, en} 对象解构（review M2：消除位置参数顺序错陷阱）。
// paramRenderers / summaryTemplate 仍保留 PR1b stub 结构（{} / () => zh）—— renderer 迁移见 PR3c。
function createPr1bDisplay({ zh, en }: { zh: string; en: string }): AtomContractDisplay {
  return {
    publicName: { zh, en },
    paramRenderers: {},
    summaryTemplate: () => zh,
  }
}

function createPr1bEmit(key: AtomContractKey, bucket: AtomContractBucket): Pr1bStubEmit {
  const [domain, ...objectParts] = key.split('.')
  return {
    capability: {
      domain: bucket,
      verb: 'emit',
      object: objectParts.length > 0 ? objectParts.join('.') : domain,
    },
    capabilityStatus: 'pr1b-stub',
    irShape: createPr1bStubIrShape(key),
    evidenceSource: bucket === 'positionConstraint' || bucket === 'orchestration' ? 'segment' : 'clause',
  }
}

function completePr1bRegistry<const T extends Record<AtomContractKey, AtomContractSeed>>(
  registry: T,
): CompletedPr1bRegistry<T> {
  const completed: Partial<Record<AtomContractKey, AtomContract>> = {}
  for (const key of Object.keys(registry) as Array<keyof T & AtomContractKey>) {
    const bucket = ATOM_BUCKETS[key]
    completed[key] = {
      ...registry[key],
      key,
      bucket,
      display: registry[key].display ?? createPr1bDisplay(ATOM_PUBLIC_NAMES[key]),
      emit: createPr1bEmit(key, bucket),
    } as AtomContract
  }
  return completed as CompletedPr1bRegistry<T>
}

// =========================================================
// 注册表定义
// =========================================================

export const ATOM_CONTRACT_REGISTRY = completePr1bRegistry({
  // ── 触发信号（triggers）── 通用流水线 + presentationRegistry 文案
  'volume.threshold': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['成交量', '量能', '放量', 'volume'] as const,
        verbs: {
          gte: ['大于', '超过', 'gte', 'greater than', 'exceeds'] as const,
        },
      },
      paramSlots: {
        operator: { kind: 'enum', required: false, enum: ['GT', 'GTE', 'LT', 'LTE'], default: 'GT', extractor: { kind: 'enum-zh-map', enumMap: { '大于': 'GT', '超过': 'GT', '大于等于': 'GTE', '小于': 'LT', '低于': 'LT', '小于等于': 'LTE' } } },
        metric: { kind: 'enum', required: false, enum: ['base_volume', 'quote_volume'], default: 'base_volume', extractor: { kind: 'enum-zh-map', enumMap: { '成交量': 'base_volume', '量能': 'base_volume', '成交额': 'quote_volume' } } },
        value: { kind: 'number', required: false, range: [0, 1e12], extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'volatility.atr_threshold': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['ATR', 'atr', '波动率'] as const,
        verbs: {
          gte: ['大于', '超过', 'greater than'] as const,
          lte: ['小于', '低于', 'less than'] as const,
        },
      },
      paramSlots: {
        operator: { kind: 'enum', required: false, enum: ['GT', 'GTE', 'LT', 'LTE'], default: 'GT', extractor: { kind: 'enum-zh-map', enumMap: { '大于': 'GT', '超过': 'GT', '大于等于': 'GTE', '小于': 'LT', '低于': 'LT', '小于等于': 'LTE' } } },
        period: { kind: 'number', required: false, range: [1, 500], default: 14, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        threshold: { kind: 'number', required: false, range: [0, 1e6], extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?' } },
        thresholdUnit: { kind: 'enum', required: false, enum: ['quote_currency', 'percent'], default: 'quote_currency', extractor: { kind: 'enum-zh-map', enumMap: { 'USDT': 'quote_currency', 'USD': 'quote_currency', '%': 'percent' } } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'strategy.time_window': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['时间窗口', '北京时间', 'time window', 'allow entries', 'trade during'] as const,
        verbs: {
          fixed: ['内允许', '内开仓', 'between', 'during'] as const,
        },
      },
      paramSlots: {
        timezone: { kind: 'enum', required: false, enum: ['Asia/Shanghai', 'UTC'], extractor: { kind: 'enum-zh-map', enumMap: { '北京时间': 'Asia/Shanghai', '北京': 'Asia/Shanghai', 'UTC': 'UTC' } } },
        windows: { kind: 'duration', required: false, extractor: { kind: 'time-window-list' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'oscillator.rsi_lte': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['RSI', 'rsi'] as const,
        verbs: {
          lte: ['低于', '小于', '下方', '跌破', 'below', 'under', 'less than', 'falls below', 'drops below'] as const,
        },
      },
      paramSlots: {
        period: { kind: 'number', required: false, range: [1, 200], default: 14, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 200] } },
        value: { kind: 'number', required: true, range: [0, 100], extractor: { kind: 'number-int', pattern: '\\d+', range: [0, 100] } },
        thresholdRole: { kind: 'enum', required: false, enum: ['lower_threshold'], default: 'lower_threshold' },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'oscillator.rsi_gte': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['RSI', 'rsi', '超买'] as const,
        verbs: {
          gte: ['高于', '大于', '超过', '上方', 'above', 'over', 'greater than'] as const,
        },
      },
      paramSlots: {
        period: { kind: 'number', required: false, range: [1, 200], default: 14, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 200] } },
        value: { kind: 'number', required: true, range: [0, 100], extractor: { kind: 'number-int', pattern: '\\d+', range: [0, 100] } },
        thresholdRole: { kind: 'enum', required: false, enum: ['upper_threshold'], default: 'upper_threshold' },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'bollinger.touch_upper': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['布林带', '布林线', 'bollinger', '上轨'] as const,
        verbs: {
          touch_upper: ['触及', '碰到', '到达', 'touch', 'reaches'] as const,
          breakout_up: ['突破', '上破', 'breakout'] as const,
        },
      },
      paramSlots: {
        band: { kind: 'enum', required: false, enum: ['upper'], default: 'upper' },
        period: { kind: 'number', required: false, range: [1, 500], default: 20, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        stdDev: { kind: 'number', required: false, range: [0.1, 10], default: 2, extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?', range: [0.1, 10] } },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'], extractor: { kind: 'enum-zh-map', enumMap: { '触及': 'touch', '碰到': 'touch', '触碰': 'touch', '突破': 'breakout', '上破': 'breakout', '跌破': 'breakout', '收盘确认': 'close', '收盘': 'close' } } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'bollinger.touch_lower': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['布林带', '布林线', 'bollinger', '下轨'] as const,
        verbs: {
          touch_lower: ['触及', '碰到', '到达', 'touch', 'reaches'] as const,
          breakout_down: ['跌破', '下破', 'breakdown'] as const,
        },
      },
      paramSlots: {
        band: { kind: 'enum', required: false, enum: ['lower'], default: 'lower' },
        period: { kind: 'number', required: false, range: [1, 500], default: 20, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        stdDev: { kind: 'number', required: false, range: [0.1, 10], default: 2, extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?', range: [0.1, 10] } },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'], extractor: { kind: 'enum-zh-map', enumMap: { '触及': 'touch', '碰到': 'touch', '触碰': 'touch', '突破': 'breakout', '上破': 'breakout', '跌破': 'breakout', '收盘确认': 'close', '收盘': 'close' } } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'bollinger.touch_middle': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['布林带', '布林线', 'bollinger', '中轨', '中线'] as const,
        verbs: {
          touch_middle: ['触及', '回踩', '碰到', 'touch', 'retest'] as const,
        },
      },
      paramSlots: {
        band: { kind: 'enum', required: false, enum: ['middle'], default: 'middle' },
        period: { kind: 'number', required: false, range: [1, 500], default: 20, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        stdDev: { kind: 'number', required: false, range: [0.1, 10], default: 2, extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?', range: [0.1, 10] } },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'], extractor: { kind: 'enum-zh-map', enumMap: { '触及': 'touch', '碰到': 'touch', '触碰': 'touch', '突破': 'breakout', '上破': 'breakout', '跌破': 'breakout', '收盘确认': 'close', '收盘': 'close' } } },
      },
      phaseResolver: 'fixed-exit',
      sideResolver: 'inherit',
    },
  },

  'price.percent_change': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['价格', '收盘价', '涨跌幅', '百分比', 'price', 'percent change'] as const,
        verbs: {
          gte: ['上涨', '涨', 'rise', 'up'] as const,
          lte: ['下跌', '跌', 'drop', 'down'] as const,
        },
      },
      paramSlots: {
        direction: { kind: 'enum', required: true, enum: ['up', 'down'], extractor: { kind: 'enum-zh-map', enumMap: { '上涨': 'up', '涨': 'up', 'rise': 'up', 'up': 'up', '下跌': 'down', '跌': 'down', 'drop': 'down', 'down': 'down' } } },
        valuePct: { kind: 'percent', required: true, range: [-100, 100], extractor: { kind: 'percent', pattern: '-?\\d+(\\.\\d+)?%', range: [-100, 100] } },
        basis: { kind: 'enum', required: false, enum: ['prev_close', 'entry_avg_price', 'current_price'], extractor: { kind: 'enum-zh-map', enumMap: { '相对上一根 K 线收盘价': 'prev_close', '相对上一根收盘': 'prev_close', '上一根收盘价': 'prev_close', '入场均价': 'entry_avg_price', '开仓均价': 'entry_avg_price', '当前价': 'current_price', '现价': 'current_price' } } },
        window: { kind: 'duration', required: false, extractor: { kind: 'duration', pattern: '\\d+[mhd]' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.breakout_up': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['突破', '前高', '高点', 'channel high', 'breakout'] as const,
        verbs: {
          breakout_up: ['突破', '升破', '上破', 'breakout'] as const,
        },
      },
      paramSlots: {
        period: { kind: 'number', required: false, range: [1, 1000], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 1000] } },
        reference: { kind: 'enum', required: true, enum: ['channel_high', 'unknown'], default: 'channel_high' },
        bufferPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.breakout_down': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['跌破', '前低', '低点', 'channel low', 'breakdown'] as const,
        verbs: {
          breakout_down: ['跌破', '跌回', '下破', '跌穿', 'breakdown'] as const,
        },
      },
      paramSlots: {
        period: { kind: 'number', required: false, range: [1, 1000], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 1000] } },
        reference: { kind: 'enum', required: true, enum: ['channel_low', 'unknown'], default: 'channel_low' },
        bufferPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.detect.indicator_boundary': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        // Issue #1279 PR2b：补 '上边界'/'下边界'/'中线' 与英文 'channel' 关键词，覆盖
        //   "突破上边界开空"、"price touch channel lower" 这类真实 utterance（baseline 修复）
        keywords: ['指标边界', '布林带', '通道', '上轨', '下轨', '中轨', '上边界', '下边界', '中线', 'boundary', 'channel'] as const,
        verbs: {
          touch_upper: ['触及上轨', '触及上边界', 'touch upper'] as const,
          touch_lower: ['触及下轨', '触及下边界', 'touch lower'] as const,
          touch_middle: ['触及中轨', '触及中线', 'touch middle'] as const,
          breakout_up: ['突破上轨', '上破边界', 'breakout upper'] as const,
          breakout_down: ['跌破下轨', '下破边界', 'breakdown lower'] as const,
        },
      },
      paramSlots: {
        boundaryRole: { kind: 'enum', required: true, enum: ['upper', 'lower', 'middle'], extractor: { kind: 'enum-zh-map', enumMap: { '上轨': 'upper', '上边界': 'upper', '下轨': 'lower', '下边界': 'lower', '中轨': 'middle', '中线': 'middle' } } },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'], extractor: { kind: 'enum-zh-map', enumMap: { '触及': 'touch', '碰到': 'touch', '突破': 'breakout', '上破': 'breakout', '跌破': 'breakout', '收盘': 'close' } } },
        sourceText: { kind: 'enum', required: false, enum: ['boundary'] },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'indicator.cross_over': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['均线', 'MA', 'EMA', 'RSI', 'MACD', 'DIF', 'DEA', 'indicator'] as const,
        verbs: {
          cross_over: ['上穿', '金叉', '穿回', '向上穿回', 'cross over', 'crosses above'] as const,
        },
      },
      paramSlots: {
        indicator: { kind: 'enum', required: true, enum: ['ma', 'ema', 'rsi', 'macd'], extractor: { kind: 'enum-zh-map', enumMap: { 'MA': 'ma', '均线': 'ma', 'EMA': 'ema', '指数均线': 'ema', 'RSI': 'rsi', 'MACD': 'macd', 'DIF': 'macd', 'DEA': 'macd' } } },
        semantic: { kind: 'enum', required: false, enum: ['cross_up'] },
        value: { kind: 'number', required: false, range: [0, 100], extractor: { kind: 'number-int', pattern: '\\d+', range: [0, 100] } },
        period: { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        fastPeriod: { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        slowPeriod: { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        signalPeriod: { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'from-direction',
    },
  },

  'indicator.cross_under': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['均线', 'MA', 'EMA', 'RSI', 'MACD', 'DIF', 'DEA', 'indicator'] as const,
        verbs: {
          cross_under: ['下穿', '死叉', '跌破', '向下穿过', 'cross under', 'crosses below'] as const,
        },
      },
      paramSlots: {
        indicator: { kind: 'enum', required: true, enum: ['ma', 'ema', 'rsi', 'macd'], extractor: { kind: 'enum-zh-map', enumMap: { 'MA': 'ma', '均线': 'ma', 'EMA': 'ema', '指数均线': 'ema', 'RSI': 'rsi', 'MACD': 'macd', 'DIF': 'macd', 'DEA': 'macd' } } },
        semantic: { kind: 'enum', required: false, enum: ['cross_down'] },
        value: { kind: 'number', required: false, range: [0, 100], extractor: { kind: 'number-int', pattern: '\\d+', range: [0, 100] } },
        period: { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        fastPeriod: { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        slowPeriod: { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        signalPeriod: { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'from-direction',
    },
  },

  'indicator.above': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['价格', '收盘价', 'MA', 'EMA', '均线', 'indicator'] as const,
        verbs: {
          gte: ['站上', '突破', '高于', '上方', 'above', 'over'] as const,
        },
      },
      paramSlots: {
        indicator: { kind: 'enum', required: true, enum: ['ma', 'ema'], extractor: { kind: 'enum-zh-map', enumMap: { 'MA': 'ma', '均线': 'ma', 'EMA': 'ema', '指数均线': 'ema' } } },
        referenceRole: { kind: 'enum', required: false, enum: ['short_term', 'mid_term', 'long_term'], extractor: { kind: 'enum-zh-map', derive: 'period-range' } },
        'reference.period': { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        timeframeOverride: { kind: 'enum', required: false, enum: ['true'], default: 'true' },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'from-direction',
    },
  },

  'indicator.below': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['价格', '收盘价', 'MA', 'EMA', '均线', 'indicator'] as const,
        verbs: {
          lte: ['跌破', '下穿', '低于', '下方', 'below', 'under'] as const,
        },
      },
      paramSlots: {
        indicator: { kind: 'enum', required: true, enum: ['ma', 'ema'], extractor: { kind: 'enum-zh-map', enumMap: { 'MA': 'ma', '均线': 'ma', 'EMA': 'ema', '指数均线': 'ema' } } },
        referenceRole: { kind: 'enum', required: false, enum: ['short_term', 'mid_term', 'long_term'], extractor: { kind: 'enum-zh-map', derive: 'period-range' } },
        'reference.period': { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        timeframeOverride: { kind: 'enum', required: false, enum: ['true'], default: 'true' },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'from-direction',
    },
  },

  'execution.on_start': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: true,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['立即', '立刻', '开始时', '启动时', 'on start', 'immediately'] as const,
        verbs: {
          fixed: ['市价买入', '市价卖出', '开仓', '平仓', 'market'] as const,
        },
      },
      paramSlots: {
        timing: { kind: 'enum', required: false, enum: ['on_start'], default: 'on_start' },
        orderType: { kind: 'enum', required: false, enum: ['market'], default: 'market', extractor: { kind: 'enum-zh-map', enumMap: { '市价': 'market', '市价买入': 'market', '市价卖出': 'market' } } },
        occurrence: { kind: 'enum', required: false, enum: ['once'], default: 'once' },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'trend.direction': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['趋势', '大趋势', '市场趋势', 'trend'] as const,
        verbs: {
          fixed: ['向上', '上涨', '多头', '向下', '下跌', '空头', 'up', 'down', 'bull', 'bear'] as const,
        },
      },
      paramSlots: {
        value: { kind: 'enum', required: true, enum: ['up', 'down'], extractor: { kind: 'enum-zh-map', enumMap: { '向上': 'up', '上涨': 'up', '多头': 'up', 'up': 'up', 'bull': 'up', '向下': 'down', '下跌': 'down', '空头': 'down', 'down': 'down', 'bear': 'down' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  'market.regime': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['市场状态', '行情', '震荡', '盘整', 'regime', 'range-bound'] as const,
        verbs: {
          fixed: ['震荡区间', '区间震荡', '盘整', 'range-bound'] as const,
        },
      },
      paramSlots: {
        value: { kind: 'enum', required: true, enum: ['range', 'trend', 'volatile'], extractor: { kind: 'enum-zh-map', enumMap: { '震荡区间': 'range', '区间震荡': 'range', '盘整': 'range', 'range-bound': 'range', 'range': 'range', '趋势': 'trend', 'trend': 'trend', '高波动': 'volatile', 'volatile': 'volatile' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'both',
    },
  },

  'volatility.state': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['波动率', '高波动', '低波动', 'volatility'] as const,
        verbs: {
          fixed: ['过高', '偏低', '升高', '降低', 'high', 'low'] as const,
        },
      },
      paramSlots: {
        value: { kind: 'enum', required: true, enum: ['high', 'low'], extractor: { kind: 'enum-zh-map', enumMap: { '过高': 'high', '高': 'high', '升高': 'high', 'high': 'high', '偏低': 'low', '低': 'low', '降低': 'low', 'low': 'low' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'both',
    },
  },

  'price.range_position_lte': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['区间', '区间低位', '区间底部', 'range'] as const,
        verbs: {
          lte: ['区间下', '低位', '底部', 'lower range'] as const,
        },
      },
      paramSlots: {
        lookbackBars: { kind: 'number', required: false, range: [1, 5000], default: 20, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 5000] } },
        thresholdPct: { kind: 'percent', required: true, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.range_position_gte': {
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['区间', '区间高位', '区间顶部', 'range'] as const,
        verbs: {
          gte: ['区间上', '高位', '顶部', 'upper range'] as const,
        },
      },
      paramSlots: {
        lookbackBars: { kind: 'number', required: false, range: [1, 5000], default: 20, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 5000] } },
        thresholdPct: { kind: 'percent', required: true, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'indicator.divergence': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['背离', '顶背离', '底背离', 'divergence', 'bullish divergence', 'bearish divergence'] as const,
        verbs: {
          divergence: ['背离', 'divergence'] as const,
        },
      },
      paramSlots: {
        indicator: { kind: 'enum', required: false, enum: ['rsi', 'macd'], default: 'rsi', extractor: { kind: 'enum-zh-map', enumMap: { 'RSI': 'rsi', 'MACD': 'macd' } } },
        direction: { kind: 'enum', required: false, enum: ['bullish', 'bearish'], extractor: { kind: 'enum-zh-map', enumMap: { '底背离': 'bullish', '看涨背离': 'bullish', 'bullish': 'bullish', '顶背离': 'bearish', '看跌背离': 'bearish', 'bearish': 'bearish' } } },
        pivotWindow: { kind: 'number', required: false, range: [1, 500], default: 14, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        confirmationBars: { kind: 'number', required: false, range: [1, 100], default: 3, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 100] } },
        sourceText: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.candle_pattern': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        // Issue #1279 PR2b：补 '连续' / 'consecutive' / 'body' 关键词，覆盖
        //   "bullish consecutive body 连续 3 根" 这类真实 utterance（baseline 修复）
        keywords: ['吞没', '锤子', '十字星', '连续', 'candle pattern', 'engulfing', 'hammer', 'doji', 'consecutive', 'body'] as const,
        verbs: {
          fixed: ['出现', '形态', '根', 'pattern', 'confirmed'] as const,
        },
      },
      paramSlots: {
        pattern: { kind: 'enum', required: true, enum: ['engulfing', 'hammer', 'doji', 'consecutive_body'], extractor: { kind: 'enum-zh-map', enumMap: { '吞没': 'engulfing', 'engulfing': 'engulfing', '锤子': 'hammer', 'hammer': 'hammer', '十字星': 'doji', 'doji': 'doji', '连续阳线': 'consecutive_body', '连续阴线': 'consecutive_body', 'consecutive body': 'consecutive_body', '连续': 'consecutive_body' } } },
        direction: { kind: 'enum', required: false, enum: ['bullish', 'bearish'], extractor: { kind: 'enum-zh-map', enumMap: { '看涨': 'bullish', 'bullish': 'bullish', '看跌': 'bearish', 'bearish': 'bearish' } } },
        minBars: { kind: 'number', required: false, range: [1, 100], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 100] } },
        sourceText: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.chart_pattern': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['头肩', '双顶', '双底', '三角形', 'chart pattern', 'head and shoulders', 'double top', 'double bottom', 'triangle'] as const,
        verbs: {
          breakout_up: ['突破', '上破', 'breakout'] as const,
          breakout_down: ['跌破', '下破', 'breakdown'] as const,
        },
      },
      paramSlots: {
        pattern: { kind: 'enum', required: true, enum: ['head_and_shoulders', 'double_top', 'double_bottom', 'triangle'], extractor: { kind: 'enum-zh-map', enumMap: { '头肩底': 'head_and_shoulders', '头肩顶': 'head_and_shoulders', '头肩': 'head_and_shoulders', 'head and shoulders': 'head_and_shoulders', '双顶': 'double_top', 'double top': 'double_top', '双底': 'double_bottom', 'double bottom': 'double_bottom', '三角形': 'triangle', 'triangle': 'triangle' } } },
        direction: { kind: 'enum', required: false, enum: ['bullish', 'bearish'], extractor: { kind: 'enum-zh-map', enumMap: { '看涨': 'bullish', 'bullish': 'bullish', '看跌': 'bearish', 'bearish': 'bearish' } } },
        sourceText: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'liquidity.sweep': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        // Issue #1279 PR2b：补 '假突破' / 'fake breakout' 关键词，覆盖
        //   "假突破后入场" 这类真实 utterance（baseline 修复）
        keywords: ['流动性', '前低', '前高', '扫', '假突破', 'sweep', 'liquidity', 'prev low', 'prev high', 'session low', 'session high', 'fake breakout', 'stop hunt'] as const,
        verbs: {
          // critic m1 fix: '扫前低'/'扫前高' 在 extractor 中仅作为提示文本出现，PR1b 加 fixture 后再决定保留
          touch_lower: ['sweep at prev low'] as const,
          touch_upper: ['sweep at prev high'] as const,
        },
      },
      paramSlots: {
        direction: { kind: 'enum', required: false, enum: ['bullish', 'bearish'], extractor: { kind: 'enum-zh-map', enumMap: { '做多': 'bullish', 'bullish': 'bullish', '反弹': 'bullish', '做空': 'bearish', 'bearish': 'bearish', '回落': 'bearish' } } },
        reference: { kind: 'enum', required: false, enum: ['prev_low', 'prev_high', 'session_low', 'session_high'], extractor: { kind: 'enum-zh-map', enumMap: { '前低': 'prev_low', 'prev low': 'prev_low', '前高': 'prev_high', 'prev high': 'prev_high', 'session low': 'session_low', '日内低点': 'session_low', 'session high': 'session_high', '日内高点': 'session_high' } } },
        reclaimBars: { kind: 'number', required: false, range: [1, 100], extractor: { kind: 'number-int', pattern: '(?<=后\\s*)\\d+(?=\\s*根)', range: [1, 100] } },
        sourceText: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'external.signal': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        // critic m1 fix: 'whale_buy'/'whale_sell' 是事件名而非 utterance 同义词，移除；'on'/'when' 是连接词非触发动词，移除
        keywords: ['webhook', '外部信号', '信号', 'signal', 'signalId'] as const,
        verbs: {
          fixed: ['收到', '触发'] as const,
        },
      },
      paramSlots: {
        provider: { kind: 'enum', required: false, enum: ['webhook'], default: 'webhook', extractor: { kind: 'enum-zh-map', enumMap: { 'webhook': 'webhook' } } },
        signalId: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause', pattern: 'signalId\\s*[=为：:]?\\s*([A-Za-z0-9_]+)' } },
        secret: { kind: 'enum', required: false, enum: ['configured'], extractor: { kind: 'enum-zh-map', enumMap: { 'secret': 'configured', 'configured': 'configured' } } },
        sourceText: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  // ── 持仓条件（positionConstraint 以 trigger 身份出现）
  'position.has_position': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: ['position.no_position'],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['已有', '已持有', '持仓时', 'has position', 'in position', 'when in'] as const,
        verbs: {
          fixed: ['不再', '时不', 'block entries', 'when'] as const,
        },
      },
      paramSlots: {
        sideScope: { kind: 'enum', required: false, enum: ['long', 'short', 'both'], default: 'both', extractor: { kind: 'enum-zh-map', enumMap: { '多头': 'long', '多单': 'long', '做多': 'long', 'long': 'long', '空头': 'short', '空单': 'short', '做空': 'short', 'short': 'short', '任意': 'both', '双向': 'both', 'both': 'both' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  'position.no_position': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: ['position.has_position'],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['无仓位', '无多头', '无空头', '空仓', 'flat', 'only when flat', 'enter only when'] as const,
        verbs: {
          fixed: ['才', '时', 'when'] as const,
        },
      },
      paramSlots: {
        sideScope: { kind: 'enum', required: false, enum: ['long', 'short', 'both'], default: 'both', extractor: { kind: 'enum-zh-map', enumMap: { '无多头': 'long', '无多单': 'long', '无空头': 'short', '无空单': 'short', '空仓': 'both', '无仓位': 'both', 'flat': 'both' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  // ── 行动（actions）
  'action.add_position': {
    summaryContribution: ({ params }) => {
      // inline 自定义：addMode + addRatio 精简摘要
      const addRatio = typeof params.addRatio === 'number' ? params.addRatio : null
      const addMode = typeof params.addMode === 'string' ? params.addMode : null
      const profitThreshold = typeof params.profitThreshold === 'number' ? params.profitThreshold : null
      const drawdownThreshold = typeof params.drawdownThreshold === 'number' ? params.drawdownThreshold : null

      const ratioPct = addRatio !== null ? `${Math.round(addRatio * 100)}%` : null

      if (addMode === 'profit_pct') {
        const triggerPart = profitThreshold !== null ? `盈利 ${profitThreshold}% 后` : '盈利后'
        return ratioPct ? `加仓：${triggerPart}加仓 ${ratioPct}` : `加仓：${triggerPart}加仓`
      }
      if (addMode === 'drawdown_pct') {
        const triggerPart = drawdownThreshold !== null ? `回撤 ${drawdownThreshold}% 后` : '回撤后'
        return ratioPct ? `加仓：${triggerPart}加仓 ${ratioPct}` : `加仓：${triggerPart}加仓`
      }
      if (addMode === 'signal_confirm') {
        return ratioPct ? `加仓：信号确认后加仓 ${ratioPct}` : '加仓：信号确认后加仓'
      }
      return ratioPct ? `加仓：每次 ${ratioPct}` : '加仓'
    },
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey) => {
      if (slotKey === 'action.add_position.constraint') {
        return '请补充加仓约束，例如：最多加仓 3 次，或最大总敞口 30%。'
      }
      return '请补充加仓条件的缺失信息。'
    },
    mutex: [],
    isActionable: true,
    sizingEvidence: null,
    surface: {
      intent: {
        // critic m1 fix: 删除 '加码'/'追仓'（extractor/utterance/fixture 全仓 0 命中的凭空同义词）
        keywords: ['加仓', '补仓', 'add position', 'scale in', 'pullback'] as const,
        verbs: {
          // critic M2 fix: 移除通用连接词 '后'/'时'/'when'/'after'，仅保留语义触发词
          fixed: ['回踩', '盈利', '回撤'] as const,
        },
      },
      paramSlots: {
        sideScope: { kind: 'enum', required: false, enum: ['long', 'short', 'both'], default: 'long', extractor: { kind: 'enum-zh-map', enumMap: { '多': 'long', '多头': 'long', '做多': 'long', '空': 'short', '空头': 'short', '做空': 'short' } } },
        addMode: { kind: 'enum', required: false, enum: ['signal_confirm', 'profit_pct', 'drawdown_pct'], extractor: { kind: 'enum-zh-map', enumMap: { '信号确认': 'signal_confirm', '回踩': 'signal_confirm', '盈利': 'profit_pct', '回撤': 'drawdown_pct' } } },
        addRatio: { kind: 'percent', required: false, range: [0, 1], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        profitThreshold: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        drawdownThreshold: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'action.reverse_position': {
    summaryContribution: ({ params }) => {
      const fromSide = typeof params.fromSide === 'string' ? params.fromSide : null
      const toSide = typeof params.toSide === 'string' ? params.toSide : null
      if (fromSide && toSide) {
        const from = fromSide === 'long' ? '多' : fromSide === 'short' ? '空' : fromSide
        const to = toSide === 'long' ? '多' : toSide === 'short' ? '空' : toSide
        return `反手：由${from}翻${to}`
      }
      return '反手'
    },
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: true,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['反手', '翻仓', '反向开仓', '反转持仓', 'reverse position', 'flip position'] as const,
        verbs: {
          fixed: ['下穿', '信号反转', '由多翻空', '由空翻多', 'reverse', 'flip'] as const,
        },
      },
      paramSlots: {
        fromSide: { kind: 'enum', required: false, enum: ['long', 'short'], extractor: { kind: 'enum-zh-map', enumMap: { '由多': 'long', '多翻': 'long', '由空': 'short', '空翻': 'short' } } },
        toSide: { kind: 'enum', required: false, enum: ['long', 'short'], extractor: { kind: 'enum-zh-map', enumMap: { '翻空': 'short', '翻多': 'long' } } },
        sameBarPolicy: { kind: 'enum', required: false, enum: ['next_bar_only', 'allow'], default: 'next_bar_only', extractor: { kind: 'enum-zh-map', enumMap: { '下一根': 'next_bar_only', '同根允许': 'allow', '允许同根': 'allow' } } },
        sizingSource: { kind: 'enum', required: false, enum: ['fixed', 'current_position'], default: 'fixed', extractor: { kind: 'enum-zh-map', enumMap: { '固定': 'fixed', '原仓位': 'current_position', '当前仓位': 'current_position' } } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  // ── 风险（risk）
  // 产品决策：risk.partial_take_profit 保持 recognized_unsupported（公测，不改为 supported）
  //   readinessCheck = UNSUPPORTED_SKIP（critic Major #3）：声明"contractReadiness 主动跳过"，
  //   避免与 COMMON_PIPELINE 混淆。summaryContribution 仍 VIA_PRESENTATION_DISPLAY
  //   是为了 partial_take_profit fallback 到 unsupported 路径时仍能渲染 publicName 给用户看
  'risk.partial_take_profit': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: UNSUPPORTED_SKIP,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: ATOM_MUTEX['risk.partial_take_profit'] ?? [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        // Issue #1279 PR2b：补 '档' / '减' / '平' 关键词，覆盖中文分档语法
        //   "第一档 +5% 减 30%" / "盈利 5% 平一半" 等真实 utterance（baseline 修复）
        keywords: ['止盈', '分批止盈', '部分平仓', '档', '减仓', '减', 'take profit', 'partial take profit', 'scale out', 'tier'] as const,
        verbs: {
          gte: ['盈利', '达到', '第一档', '第二档', '第三档', 'profit', 'at', 'tier'] as const,
        },
      },
      paramSlots: {
        profitPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        ratio: { kind: 'percent', required: false, range: [0, 1], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'fixed-exit',
      sideResolver: 'inherit',
    },
  },

  // ── 组合风险 orchestration（portfolioRisk）
  'portfolioRisk.drawdown_block': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    surface: {
      intent: {
        keywords: ['账户回撤', '最大回撤', '组合回撤', '熔断', 'drawdown', 'account drawdown', 'max drawdown'] as const,
        verbs: {
          gte: ['超过', '达到', '触及', 'exceeds', 'reaches'] as const,
        },
      },
      paramSlots: {
        thresholdPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        lookbackWindow: { kind: 'duration', required: false, extractor: { kind: 'duration', pattern: '\\d+[mhd]' } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'both',
    },
  },

  // ── 仓位约束（positionConstraint）
  'position.dca_schedule': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: true,
    sizingEvidence: DCA_SIZING_EVIDENCE,
    surface: {
      intent: {
        keywords: ['定投', 'DCA', 'dca', '每跌', '分批入场', 'price drops', 'each interval'] as const,
        verbs: {
          fixed: ['跌', '每', '间隔', 'every', 'drops', 'interval'] as const,
        },
      },
      paramSlots: {
        interval: { kind: 'duration', required: false, extractor: { kind: 'duration', pattern: '\\d+[mhd]' } },
        dropPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        perOrderBudget: { kind: 'number', required: false, range: [0, 1e9], extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?' } },
        maxOrders: { kind: 'number', required: false, range: [1, 1000], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 1000] } },
      },
      phaseResolver: 'fixed-entry',
      sideResolver: 'inherit',
    },
  },

  // Issue #1191：pyramiding 加入 atom contract registry，sizingEvidence 指向
  //   capital.allocate.per_order_budget；atom 通过 action.add_position 子句间接
  //   触发，无独立 utterance fixture（已在 utterance-corpus.spec
  //   RENDER_CONTRACT_ALLOWED_MISSING_FIXTURE 显式登记）。
  'position.pyramiding_limit': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: true,
    sizingEvidence: PYRAMIDING_SIZING_EVIDENCE,
    surface: {
      intent: {
        keywords: ['最多加仓', '金字塔', '加仓层数', 'pyramiding', 'max adds', 'max layers'] as const,
        verbs: {
          fixed: ['最多', '不超过', 'max', 'up to'] as const,
        },
      },
      paramSlots: {
        maxLayers: { kind: 'number', required: false, range: [1, 50], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 50] } },
        layerSizing: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'fixed-entry',
      sideResolver: 'inherit',
    },
  },

  // Issue #1198：grid.range_rebalance 加入 atom contract registry，sizingEvidence 指向
  //   capital.allocate.per_order_budget；emit 路径在 seed-extractor
  //   `buildGridOrderProgramActionContracts`，PR #1197 已补顶层 kind: 'quote'。
  //   atom 通过 grid 触发器子句（"区间 X-Y, 每格 N USDT"）间接落位，无独立 utterance fixture
  //   （已在 utterance-corpus.spec 的 atomsExemptFromOpenSlotCoverage + 顶层 for-skip 显式登记）。
  'grid.range_rebalance': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: true,
    sizingEvidence: GRID_SIZING_EVIDENCE,
    surface: {
      intent: {
        keywords: ['网格', '区间网格', '区间', '挂格', 'grid', 'range', 'rebalance'] as const,
        verbs: {
          fixed: ['网格', '区间', '每格', '挂', 'grid', 'range', 'each grid'] as const,
        },
      },
      paramSlots: {
        rangeLower: { kind: 'number', required: false, range: [0, 1e9], extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?' } },
        rangeUpper: { kind: 'number', required: false, range: [0, 1e9], extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?' } },
        sideMode: { kind: 'enum', required: false, enum: ['long_only', 'short_only', 'both'], default: 'both', extractor: { kind: 'enum-zh-map', enumMap: { '只做多': 'long_only', '仅做多': 'long_only', '只做空': 'short_only', '仅做空': 'short_only', '双向': 'both' } } },
        recycle: { kind: 'enum', required: false, enum: ['true', 'false'], default: 'true', extractor: { kind: 'enum-zh-map', enumMap: { '循环': 'true', 'recycle': 'true', '不循环': 'false' } } },
        breakoutAction: { kind: 'enum', required: false, enum: ['continue', 'stop'], default: 'continue', extractor: { kind: 'enum-zh-map', enumMap: { '继续': 'continue', '停止': 'stop', 'continue': 'continue', 'stop': 'stop' } } },
        perGridSizing: { kind: 'number', required: false, range: [0, 1e9], extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?' } },
      },
      phaseResolver: 'fixed-entry',
      sideResolver: 'both',
    },
  },
})

// TS exhaustive 编译期守门验证（无运行时开销）
// 若 ATOM_CONTRACT_REGISTRY 缺少任一 SupportedExecutableUtteranceAtom key → TS error
type _ExhaustiveCheck = typeof ATOM_CONTRACT_REGISTRY extends Record<SupportedExecutableUtteranceAtom, AtomContract>
  ? true
  : never
const _exhaustiveCheckPass: _ExhaustiveCheck = true
void _exhaustiveCheckPass
