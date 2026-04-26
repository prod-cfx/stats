import { Injectable } from '@nestjs/common'
import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type { PendingSemanticEdit, SemanticEditDecision, SemanticEditPatch } from '../types/semantic-edit'
import type { SemanticState } from '../types/semantic-state'
import { isProcessingCodegenSessionStatus } from '../types/codegen-session-status'
import { readPendingSemanticEdit, withPendingSemanticEdit } from '../types/semantic-edit'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'

export interface ConversationSemanticEditDecisionInput {
  status: LlmCodegenSessionStatus
  message: string
  semanticState: SemanticState
}

const PROCESSING_REJECTION_MESSAGE = '当前策略正在生成或校验，请等待完成后再修改。'

@Injectable()
export class ConversationSemanticEditService {
  applyPatch(state: SemanticState, patch: SemanticEditPatch): SemanticState {
    return patch.operations.reduce((next, operation) => {
      if (operation.op === 'cancel_pending_edit') {
        return withPendingSemanticEdit(next, null)
      }
      if (operation.op === 'replace_context') {
        return this.applyContextReplacement(next, operation.field, operation.value)
      }
      return next
    }, state)
  }

  decide(input: ConversationSemanticEditDecisionInput): SemanticEditDecision {
    const message = input.message.trim()
    if (!message) return { kind: 'NO_EDIT' }

    if (isProcessingCodegenSessionStatus(input.status) && this.hasSemanticEditIntent(message, input.semanticState)) {
      return {
        kind: 'REJECT_WHILE_PROCESSING',
        message: PROCESSING_REJECTION_MESSAGE,
      }
    }

    const symbol = this.extractReplacementSymbol(message)
    if (symbol) {
      return {
        kind: 'APPLY_TO_SEMANTIC_STATE',
        patch: {
          operations: [{ op: 'replace_context', field: 'symbol', value: symbol }],
        },
      }
    }

    const seedText = this.extractStrategyReplacementSeed(message)
    if (seedText) {
      return {
        kind: 'REPLACE_STRATEGY_DRAFT',
        seedText,
      }
    }

    if (this.isStrategyRestartWithoutSeed(message)) {
      return {
        kind: 'ASK_EDIT_CLARIFICATION',
        question: '请描述新的触发、行动、风控、仓位和运行 context，我会按新的语义重新整理策略。',
        pendingEdit: this.createStrategyReplacementSeedPendingEdit(message),
      }
    }

    if (readPendingSemanticEdit(input.semanticState) && /算了|保持原来|不改了|取消/u.test(message)) {
      return {
        kind: 'APPLY_TO_SEMANTIC_STATE',
        patch: { operations: [{ op: 'cancel_pending_edit' }] },
      }
    }

    if (/触发.*改成\s*RSI|把触发改成\s*RSI/u.test(message)) {
      const pendingEdit = this.createPendingTriggerReplacement(message)
      return {
        kind: 'ASK_EDIT_CLARIFICATION',
        question: '你正在把触发语义改成 RSI。请确认 RSI 阈值，例如低于 30 或高于 70。',
        pendingEdit,
      }
    }

    return { kind: 'NO_EDIT' }
  }

  createEmptySemanticStateForTest(): SemanticState {
    return {
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '1970-01-01T00:00:00.000Z',
    }
  }

  withPendingEditForTest(state: SemanticState, createdFromMessage: string): SemanticState {
    return withPendingSemanticEdit(state, this.createPendingTriggerReplacement(createdFromMessage))
  }

  readPendingEditForTest(state: SemanticState): PendingSemanticEdit | null {
    return readPendingSemanticEdit(state)
  }

  private applyContextReplacement(
    state: SemanticState,
    field: 'symbol' | 'timeframe' | 'exchange' | 'marketType',
    value: string,
  ): SemanticState {
    const questionHints = {
      exchange: '请确认交易所（binance / okx / hyperliquid）。',
      symbol: '请确认策略交易标的（例如 BTCUSDT）。',
      marketType: '请确认市场类型（现货或合约/perp）。',
      timeframe: '请确认策略主周期（例如 15m 或 1h）。',
    } as const

    return {
      ...state,
      contextSlots: {
        ...state.contextSlots,
        [field]: {
          slotKey: field,
          fieldPath: `contextSlots.${field}`,
          value,
          status: 'locked',
          priority: 'context',
          questionHint: questionHints[field],
          affectsExecution: true,
          evidence: {
            text: value,
            source: 'user_explicit',
          },
        },
      },
      updatedAt: new Date().toISOString(),
    }
  }

  private extractReplacementSymbol(message: string): string | null {
    const match = /交易标的\s*(?:改为|改成|换成)\s*([A-Za-z0-9:/-]+)/u.exec(message)
    return canonicalizeStrategySymbolInput(match?.[1])
  }

  private hasSemanticEditIntent(message: string, state: SemanticState): boolean {
    return Boolean(
      this.extractReplacementSymbol(message)
        || this.extractStrategyReplacementSeed(message)
        || this.isStrategyRestartWithoutSeed(message)
        || (readPendingSemanticEdit(state) && /算了|保持原来|不改了|取消/u.test(message))
        || /触发.*改成\s*RSI|把触发改成\s*RSI/u.test(message)
        || /(?:改|修改|更改|替换|删除|取消|换成|改成|改为).*(?:触发|行动|风控|仓位|止损|止盈|交易标的|周期|交易所|市场类型)/u.test(message)
        || /(?:触发|行动|风控|仓位|止损|止盈|交易标的|周期|交易所|市场类型).*(?:改|修改|更改|替换|删除|取消|换成|改成|改为)/u.test(message),
    )
  }

  private extractStrategyReplacementSeed(message: string): string | null {
    const match = /(?:之前策略不对|之前不对)[，,\s]*(重新做一个.+)$/u.exec(message)
    return match?.[1]?.trim() || null
  }

  private isStrategyRestartWithoutSeed(message: string): boolean {
    return /(?:之前策略不对|之前不对)[，,\s]*重新来$/u.test(message)
  }

  private createStrategyReplacementSeedPendingEdit(text: string): PendingSemanticEdit {
    return {
      id: `pending-strategy-replacement-seed-${Date.now()}`,
      op: 'replace_trigger',
      candidate: {
        id: `candidate-strategy-replacement-seed-${Date.now()}`,
        key: 'pending.strategy_replacement_seed',
        phase: 'gate',
        params: {},
        status: 'open',
        source: 'user_explicit',
        evidence: {
          text,
          source: 'user_explicit',
        },
        openSlots: [],
      },
      status: 'needs_clarification',
      createdFromMessage: text,
    }
  }

  private createPendingTriggerReplacement(text: string): PendingSemanticEdit {
    return {
      id: `pending-trigger-${Date.now()}`,
      op: 'replace_trigger',
      candidate: {
        id: `candidate-trigger-${Date.now()}`,
        key: 'indicator.rsi_threshold',
        phase: 'gate',
        params: { indicator: 'rsi' },
        status: 'open',
        source: 'user_explicit',
        evidence: {
          text,
          source: 'user_explicit',
        },
        openSlots: [{
          slotKey: 'trigger.rsi.threshold',
          fieldPath: 'triggers[].params.threshold',
          status: 'open',
          priority: 'behavior',
          questionHint: '请确认 RSI 阈值，例如低于 30 或高于 70。',
          affectsExecution: true,
        }],
      },
      status: 'needs_clarification',
      createdFromMessage: text,
    }
  }
}
