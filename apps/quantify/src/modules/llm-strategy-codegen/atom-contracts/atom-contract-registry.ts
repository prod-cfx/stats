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
  type AtomContractKey,
  type SizingEvidence,
} from './atom-contract-types'

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

// =========================================================
// 注册表定义
// =========================================================

export const ATOM_CONTRACT_REGISTRY: Record<AtomContractKey, AtomContract> = {
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
} satisfies Record<SupportedExecutableUtteranceAtom, AtomContract>

// TS exhaustive 编译期守门验证（无运行时开销）
// 若 ATOM_CONTRACT_REGISTRY 缺少任一 SupportedExecutableUtteranceAtom key → TS error
type _ExhaustiveCheck = typeof ATOM_CONTRACT_REGISTRY extends Record<SupportedExecutableUtteranceAtom, AtomContract>
  ? true
  : never
const _exhaustiveCheckPass: _ExhaustiveCheck = true
void _exhaustiveCheckPass
