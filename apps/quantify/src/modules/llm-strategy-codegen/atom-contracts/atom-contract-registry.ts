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
  },

  'volatility.atr_threshold': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
  },

  'strategy.time_window': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
  },

  'oscillator.rsi_lte': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
  },

  'indicator.divergence': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
  },

  'price.candle_pattern': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
  },

  'price.chart_pattern': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
  },

  'liquidity.sweep': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
  },

  // ── 持仓条件（positionConstraint 以 trigger 身份出现）
  'position.has_position': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: ['position.no_position'],
    isActionable: false,
    sizingEvidence: null,
  },

  'position.no_position': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: ['position.has_position'],
    isActionable: false,
    sizingEvidence: null,
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
  },

  // ── 组合风险 orchestration（portfolioRisk）
  'portfolioRisk.drawdown_block': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
  },

  // ── 仓位约束（positionConstraint）
  'position.dca_schedule': {
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: VIA_PRESENTATION_DISPLAY,
    mutex: [],
    isActionable: true,
    sizingEvidence: DCA_SIZING_EVIDENCE,
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
  },
} satisfies Record<SupportedExecutableUtteranceAtom, AtomContract>

// TS exhaustive 编译期守门验证（无运行时开销）
// 若 ATOM_CONTRACT_REGISTRY 缺少任一 SupportedExecutableUtteranceAtom key → TS error
type _ExhaustiveCheck = typeof ATOM_CONTRACT_REGISTRY extends Record<SupportedExecutableUtteranceAtom, AtomContract>
  ? true
  : never
const _exhaustiveCheckPass: _ExhaustiveCheck = true
void _exhaustiveCheckPass
