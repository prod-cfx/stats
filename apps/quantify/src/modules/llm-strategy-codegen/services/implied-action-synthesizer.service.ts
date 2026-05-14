import { Injectable } from '@nestjs/common'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import type { AtomContractKey } from '../atom-contracts/atom-contract-types'
import type { SemanticActionState, SemanticTriggerState } from '../types/semantic-state'

/**
 * Issue #1364 PR4 — 隐含动作合成器
 *
 * 解决 issue #1364 AC-5 策略 1：「BTC 永续 1h，EMA20 上穿 EMA50 开多，下穿平多」
 * LLM 输出 `indicator.cross_under phase=exit` 但忘了输出 `action.close_long`，
 * clarification 引擎判 `exit_semantics_missing` 走错路由。
 *
 * 修复：在 clarification 完整性判定 *之前*，按 atom 隐含动作契约（atom.impliedActions
 * — 待 follow-up 加入 contract 类型）合成缺失的 lifecycle action 进入 state.actions[]。
 *
 * 当前规则（hardcoded，待 follow-up 迁移到 contract.impliedActions 字段）：
 *   - `indicator.cross_under` phase=exit + sideScope=long  → 合成 `action.close_long`
 *   - `indicator.cross_under` phase=exit + sideScope=short → 合成 `action.close_short`
 *   - `indicator.cross_over`  phase=exit + sideScope=long  → 合成 `action.close_long`
 *   - `indicator.cross_over`  phase=exit + sideScope=short → 合成 `action.close_short`
 *
 * Wire-up：clarification 引擎应在判 `exit_semantics_missing` 前调
 * `synthesizeImpliedActions(triggers, existingActions)`，把返回的合成 action 合入
 * state.actions 再判完整性。本 PR 仅提供 helper + spec，wire-up 至 SemanticClarificationQuestionRendererService
 * 的实际接入留给 follow-up（避免触动 5000+ 行 clarification engine 内部状态机）。
 */

interface ImpliedActionRule {
  readonly triggerKey: AtomContractKey
  readonly phase: 'exit'
  readonly sideScope: 'long' | 'short'
  readonly synthesizedActionKey: AtomContractKey
}

const IMPLIED_ACTION_RULES: readonly ImpliedActionRule[] = [
  { triggerKey: 'indicator.cross_under', phase: 'exit', sideScope: 'long', synthesizedActionKey: 'action.close_long' },
  { triggerKey: 'indicator.cross_under', phase: 'exit', sideScope: 'short', synthesizedActionKey: 'action.close_short' },
  { triggerKey: 'indicator.cross_over', phase: 'exit', sideScope: 'long', synthesizedActionKey: 'action.close_long' },
  { triggerKey: 'indicator.cross_over', phase: 'exit', sideScope: 'short', synthesizedActionKey: 'action.close_short' },
] as const

@Injectable()
export class ImpliedActionSynthesizerService {
  /**
   * 扫 triggers，按规则合成隐含 lifecycle action。
   *
   * @param triggers 当前 state.triggers
   * @param existingActions 当前 state.actions（避免重复合成）
   * @param turnId 用于生成合成 action id 的命名空间
   * @returns 新合成的 action 列表（可能为空）
   */
  synthesizeImpliedActions(
    triggers: readonly SemanticTriggerState[],
    existingActions: readonly SemanticActionState[],
    turnId = 'implied',
  ): SemanticActionState[] {
    const synthesized: SemanticActionState[] = []
    const existingActionKeys = new Set(existingActions.map(a => a.key))

    for (const [index, trigger] of triggers.entries()) {
      for (const rule of IMPLIED_ACTION_RULES) {
        if (
          trigger.key === rule.triggerKey
          && trigger.phase === rule.phase
          && trigger.sideScope === rule.sideScope
          && !existingActionKeys.has(rule.synthesizedActionKey)
        ) {
          // 防 contract 注册表偏差：合成 action key 必须真实注册
          if (!(rule.synthesizedActionKey in ATOM_CONTRACT_REGISTRY)) continue
          synthesized.push({
            id: `${turnId}:implied:${trigger.id ?? index}:${rule.synthesizedActionKey}`,
            key: rule.synthesizedActionKey,
            params: {},
            status: 'open',
            source: 'inferred',
          })
          existingActionKeys.add(rule.synthesizedActionKey)
        }
      }
    }

    return synthesized
  }
}

/**
 * Issue #1364 PR4 — unsupported_fallback 路由识别器
 *
 * 解决 issue #1364 AC-5 策略 4：「BTC 现货 1d 每周一定投 100 U，加仓 ≤5 次，
 * 单笔回撤 8% 暂停定投」中「回撤暂停定投」属于真未建模语义，应走
 * `unsupported_fallback` 路由（带 publicReason），而不混入 `exit_semantics_missing`。
 *
 * 当前规则（hardcoded，待 follow-up 迁移到 contract.unsupportedPatterns 字段）：
 *   - 用户消息含「回撤」关键词 + 「暂停|停止」+ 「定投|加仓」上下文 → publicReason='drawdown_pause_dca_unsupported'
 */
export interface UnsupportedFallbackPattern {
  readonly publicReason: string
  readonly publicReasonZh: string
  readonly publicReasonEn: string
  readonly matchedPattern: string
}

const UNSUPPORTED_PATTERNS: ReadonlyArray<{
  readonly publicReason: string
  readonly publicReasonZh: string
  readonly publicReasonEn: string
  readonly keywords: readonly RegExp[]
}> = [
  {
    publicReason: 'drawdown_pause_dca_unsupported',
    publicReasonZh: '当前不支持「按账户回撤暂停定投/加仓」组合护栏；可移除该条件继续生成',
    publicReasonEn: 'Pause-DCA-on-drawdown guardrail not yet supported; remove condition to continue',
    keywords: [/回撤/, /(暂停|停止)/, /(定投|加仓)/],
  },
]

@Injectable()
export class UnsupportedFallbackClassifierService {
  classify(userMessage: string): UnsupportedFallbackPattern | null {
    for (const pattern of UNSUPPORTED_PATTERNS) {
      if (pattern.keywords.every(kw => kw.test(userMessage))) {
        return {
          publicReason: pattern.publicReason,
          publicReasonZh: pattern.publicReasonZh,
          publicReasonEn: pattern.publicReasonEn,
          matchedPattern: pattern.keywords.map(k => k.source).join(' + '),
        }
      }
    }
    return null
  }
}
