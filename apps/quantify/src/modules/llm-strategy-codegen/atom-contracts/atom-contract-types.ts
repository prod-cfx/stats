/**
 * Atom Contract Types — per-atom 全链路强契约接口（Issue #1162）
 *
 * 设计原则（Plan v2 M5 简化版）：
 *   - 4 字段：summaryContribution / readinessCheck / clarificationQuestion / mutex
 *   - Symbol sentinels：COMMON_PIPELINE / VIA_PRESENTATION_DISPLAY / NO_SUMMARY
 *   - AtomContract<> 用 TS exhaustive Record 守门；新增 atom → 编译失败
 */

import type { SupportedExecutableUtteranceAtom } from '../nl-gateway/utterance-corpus/utterance-corpus.types'

// =========================================================
// Symbol sentinels（编译期常量）
// =========================================================

/** 该 atom 不参与 conversation summary 段（如纯顶层 contextSlot） */
export const NO_SUMMARY = Symbol('no_summary')

/** summary 复用 presentationRegistry.getEntry(key).displayRenderer 文本 */
export const VIA_PRESENTATION_DISPLAY = Symbol('via_presentation_display')

/** readiness 走 contractReadiness.normalize 通用流水线（无自定义逻辑） */
export const COMMON_PIPELINE = Symbol('common_pipeline')

/**
 * #1162 critic Major #3：atom 在 atom-registry 注册为 unsupported（如公测 partial_take_profit）时，
 *   contractReadiness 主动跳过；此 sentinel 显式表达"声明已注册但行为 unsupported"，
 *   避免与 COMMON_PIPELINE 混淆产生"声明 vs 行为"错位
 */
export const UNSUPPORTED_SKIP = Symbol('unsupported_skip')

// =========================================================
// AtomContract<TParams>
// =========================================================

export interface AtomContract<TParams = Record<string, unknown>> {
  /**
   * Summary 贡献：
   *   NO_SUMMARY                   → 不参与 conversation summary
   *   VIA_PRESENTATION_DISPLAY     → 调 presentationRegistry.getEntry(key).displayRenderer
   *   (atom) => string | null      → 内联自定义文本
   */
  summaryContribution:
    | typeof NO_SUMMARY
    | typeof VIA_PRESENTATION_DISPLAY
    | ((atom: { params: TParams; status: string }) => string | null)

  /**
   * Readiness 检查：
   *   COMMON_PIPELINE              → 走通用 contractReadiness 流水线
   *   inline fn                   → 完全自定义（如 portfolioRisk.drawdown_block 的 fail-closed）
   */
  readinessCheck:
    | typeof COMMON_PIPELINE
    | typeof UNSUPPORTED_SKIP
    | ((atom: {
        params: TParams
        status: string
      }) => { satisfied: boolean; missingSlotKeys: readonly string[] })

  /**
   * Clarification 文案生成：
   *   VIA_PRESENTATION_DISPLAY     → 调 presentationRegistry.getEntry(key).clarificationRenderer
   *   (slotKey, params) => string  → 内联自定义文案
   */
  clarificationQuestion:
    | typeof VIA_PRESENTATION_DISPLAY
    | ((slotKey: string, params: TParams) => string)

  /**
   * 互斥 atom key 列表（融合 corpus-invariants ATOM_MUTEX）；无互斥时显式 []
   */
  mutex: readonly string[]
}

export type AtomContractKey = SupportedExecutableUtteranceAtom
