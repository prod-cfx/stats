import { Injectable } from '@nestjs/common'
import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type { SemanticEditDecision, PendingSemanticEdit } from '../types/semantic-edit'
import type { SemanticState, SemanticTriggerState } from '../types/semantic-state'
import { isProcessingCodegenSessionStatus } from '../types/codegen-session-status'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'

export interface ConversationSemanticEditDecisionInput {
  status: LlmCodegenSessionStatus
  message: string
  semanticState: SemanticState
}

const PROCESSING_REJECTION_MESSAGE = '当前策略正在生成或校验，请等待完成后再修改。'

@Injectable()
export class ConversationSemanticEditService {
  decide(input: ConversationSemanticEditDecisionInput): SemanticEditDecision {
    const message = input.message.trim()
    if (!message) return { kind: 'NO_EDIT' }

    if (isProcessingCodegenSessionStatus(input.status)) {
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
        pendingEdit: this.createPendingTriggerReplacement(message),
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

  private extractReplacementSymbol(message: string): string | null {
    const match = /交易标的改为\s*([A-Za-z0-9:/-]+)/u.exec(message)
    return canonicalizeStrategySymbolInput(match?.[1])
  }

  private extractStrategyReplacementSeed(message: string): string | null {
    const match = /(?:之前策略不对|之前不对)[，,\s]*(重新做一个.+)$/u.exec(message)
    return match?.[1]?.trim() || null
  }

  private isStrategyRestartWithoutSeed(message: string): boolean {
    return /(?:之前策略不对|之前不对)[，,\s]*重新来$/u.test(message)
  }

  private createPendingTriggerReplacement(message: string): PendingSemanticEdit {
    const candidate: SemanticTriggerState = {
      id: 'pending-replace-trigger',
      key: 'pending_replacement_trigger',
      phase: 'entry',
      params: {},
      status: 'open',
      source: 'user_explicit',
      evidence: {
        text: message,
        source: 'user_explicit',
      },
      openSlots: [],
    }

    return {
      id: 'pending-replace-trigger',
      op: 'replace_trigger',
      status: 'needs_clarification',
      createdFromMessage: message,
      candidate,
    }
  }
}
