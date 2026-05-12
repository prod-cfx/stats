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

const ATOM_PUBLIC_NAMES = {
  'volume.threshold': '成交量阈值',
  'volatility.atr_threshold': 'ATR 波动率阈值',
  'strategy.time_window': '交易时间窗口',
  'oscillator.rsi_lte': 'RSI 低于阈值',
  'oscillator.rsi_gte': 'RSI 高于阈值',
  'indicator.divergence': '指标背离',
  'price.candle_pattern': 'K 线形态',
  'price.chart_pattern': '图形形态',
  'liquidity.sweep': '流动性扫荡',
  'external.signal': '外部喊单 / Webhook 信号',
  'position.has_position': '已有仓位卫语句',
  'position.no_position': '无仓位卫语句',
  'bollinger.touch_upper': '触及布林上轨',
  'bollinger.touch_lower': '触及布林下轨',
  'bollinger.touch_middle': '触及布林中轨',
  'price.percent_change': '价格百分比变化',
  'price.breakout_up': '向上突破',
  'price.breakout_down': '向下跌破',
  'price.detect.indicator_boundary': '价格触及指标边界',
  'indicator.cross_over': '指标上穿',
  'indicator.cross_under': '指标下穿',
  'indicator.above': '指标高于阈值',
  'indicator.below': '指标低于阈值',
  'execution.on_start': '启动后执行',
  'trend.direction': '趋势方向',
  'market.regime': '市场状态',
  'volatility.state': '波动率状态',
  'price.range_position_lte': '区间低位',
  'price.range_position_gte': '区间高位',
  'action.add_position': '加仓',
  'action.reverse_position': '反手',
  'risk.partial_take_profit': '分批止盈',
  'portfolioRisk.drawdown_block': '组合回撤护栏',
  'position.dca_schedule': 'DCA 补仓计划',
  'position.pyramiding_limit': '金字塔加仓限制',
  'grid.range_rebalance': '网格区间再平衡',
} as const satisfies Record<AtomContractKey, string>

function createPr1bStubIrShape(key: AtomContractKey): Pr1bStubIrShapeBuilder {
  return Object.assign(
    (() => {
      throw new Error(`[#1279 PR1b stub] emit.irShape for ${key} pending PR3a IR compiler refactor`)
    }) as AtomContractEmit['irShape'],
    { __pr1bStub: true as const },
  )
}

function createPr1bDisplay(publicName: string): AtomContractDisplay {
  return {
    publicName: { zh: publicName, en: publicName },
    paramRenderers: {},
    summaryTemplate: () => publicName,
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
      paramSlots: {},
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
      paramSlots: {},
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
      paramSlots: {},
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
      paramSlots: {},
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
        period: { kind: 'number', required: false, range: [1, 200], default: 14 },
        value: { kind: 'number', required: true, range: [0, 100] },
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
        period: { kind: 'number', required: false, range: [1, 500], default: 20 },
        stdDev: { kind: 'number', required: false, range: [0.1, 10], default: 2 },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'] },
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
        period: { kind: 'number', required: false, range: [1, 500], default: 20 },
        stdDev: { kind: 'number', required: false, range: [0.1, 10], default: 2 },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'] },
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
        period: { kind: 'number', required: false, range: [1, 500], default: 20 },
        stdDev: { kind: 'number', required: false, range: [0.1, 10], default: 2 },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'] },
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
        direction: { kind: 'enum', required: true, enum: ['up', 'down'] },
        valuePct: { kind: 'percent', required: true, range: [-100, 100] },
        basis: { kind: 'enum', required: false, enum: ['prev_close', 'entry_avg_price', 'current_price'] },
        window: { kind: 'duration', required: false },
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
        period: { kind: 'number', required: false, range: [1, 1000] },
        reference: { kind: 'enum', required: true, enum: ['channel_high', 'unknown'] },
        bufferPct: { kind: 'percent', required: false, range: [0, 100] },
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
        period: { kind: 'number', required: false, range: [1, 1000] },
        reference: { kind: 'enum', required: true, enum: ['channel_low', 'unknown'] },
        bufferPct: { kind: 'percent', required: false, range: [0, 100] },
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
        keywords: ['指标边界', '布林带', '通道', '上轨', '下轨', '中轨', 'boundary'] as const,
        verbs: {
          touch_upper: ['触及上轨', '触及上边界', 'touch upper'] as const,
          touch_lower: ['触及下轨', '触及下边界', 'touch lower'] as const,
          touch_middle: ['触及中轨', '触及中线', 'touch middle'] as const,
          breakout_up: ['突破上轨', '上破边界', 'breakout upper'] as const,
          breakout_down: ['跌破下轨', '下破边界', 'breakdown lower'] as const,
        },
      },
      paramSlots: {
        boundaryRole: { kind: 'enum', required: true, enum: ['upper', 'lower', 'middle'] },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'] },
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
        indicator: { kind: 'enum', required: true, enum: ['ma', 'ema', 'rsi', 'macd'] },
        semantic: { kind: 'enum', required: false, enum: ['cross_up'] },
        value: { kind: 'number', required: false, range: [0, 100] },
        period: { kind: 'number', required: false, range: [1, 500] },
        fastPeriod: { kind: 'number', required: false, range: [1, 500] },
        slowPeriod: { kind: 'number', required: false, range: [1, 500] },
        signalPeriod: { kind: 'number', required: false, range: [1, 500] },
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
        indicator: { kind: 'enum', required: true, enum: ['ma', 'ema', 'rsi', 'macd'] },
        semantic: { kind: 'enum', required: false, enum: ['cross_down'] },
        value: { kind: 'number', required: false, range: [0, 100] },
        period: { kind: 'number', required: false, range: [1, 500] },
        fastPeriod: { kind: 'number', required: false, range: [1, 500] },
        slowPeriod: { kind: 'number', required: false, range: [1, 500] },
        signalPeriod: { kind: 'number', required: false, range: [1, 500] },
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
        indicator: { kind: 'enum', required: true, enum: ['ma', 'ema'] },
        'reference.period': { kind: 'number', required: false, range: [1, 500] },
        timeframeOverride: { kind: 'enum', required: false, enum: ['true'] },
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
        indicator: { kind: 'enum', required: true, enum: ['ma', 'ema'] },
        'reference.period': { kind: 'number', required: false, range: [1, 500] },
        timeframeOverride: { kind: 'enum', required: false, enum: ['true'] },
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
        orderType: { kind: 'enum', required: false, enum: ['market'], default: 'market' },
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
        value: { kind: 'enum', required: true, enum: ['up', 'down'] },
      },
      phaseResolver: 'by-clause-verb',
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
        value: { kind: 'enum', required: true, enum: ['range', 'trend', 'volatile'] },
      },
      phaseResolver: 'fixed-entry',
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
        value: { kind: 'enum', required: true, enum: ['high', 'low'] },
      },
      phaseResolver: 'fixed-entry',
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
        lookbackBars: { kind: 'number', required: false, range: [1, 5000], default: 20 },
        thresholdPct: { kind: 'percent', required: true, range: [0, 100] },
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
        lookbackBars: { kind: 'number', required: false, range: [1, 5000], default: 20 },
        thresholdPct: { kind: 'percent', required: true, range: [0, 100] },
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
      paramSlots: {},
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
        keywords: ['吞没', '锤子', '十字星', 'candle pattern', 'engulfing', 'hammer', 'doji'] as const,
        verbs: {
          fixed: ['出现', '形态', 'pattern', 'confirmed'] as const,
        },
      },
      paramSlots: {},
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
      paramSlots: {},
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
        keywords: ['流动性', '前低', '前高', '扫', 'sweep', 'liquidity', 'prev low', 'prev high', 'session low', 'session high'] as const,
        verbs: {
          // critic m1 fix: '扫前低'/'扫前高' 在 extractor 中仅作为提示文本出现，PR1b 加 fixture 后再决定保留
          touch_lower: ['sweep at prev low'] as const,
          touch_upper: ['sweep at prev high'] as const,
        },
      },
      paramSlots: {},
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
      paramSlots: {},
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
      paramSlots: {},
      phaseResolver: 'by-clause-verb',
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
      paramSlots: {},
      phaseResolver: 'by-clause-verb',
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
      paramSlots: {},
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
      paramSlots: {},
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
        keywords: ['止盈', '分批止盈', '部分平仓', 'take profit', 'partial take profit', 'scale out'] as const,
        verbs: {
          gte: ['盈利', '达到', 'profit', 'at'] as const,
        },
      },
      paramSlots: {},
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
      paramSlots: {},
      phaseResolver: 'fixed-entry',
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
      paramSlots: {},
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
      paramSlots: {},
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
      paramSlots: {},
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
